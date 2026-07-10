import { toPng } from "html-to-image";

export const SNS_COMPARE_EXPORT_WIDTH_PX = 1200;

export function buildCompareExportFilename(
  contentIdA: string,
  contentIdB: string,
): string {
  return `compare-${contentIdA.trim()}-${contentIdB.trim()}.png`;
}

export function buildWorkExportFilename(contentId: string): string {
  return `work-${contentId.trim()}.png`;
}

async function waitForFonts(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

async function waitForAnimationFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

export async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));

  if (images.length === 0) {
    return;
  }

  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) {
        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch {
            // decode 失敗時は load 済みなら続行
          }
        }
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (img.naturalWidth > 0) {
            resolve();
            return;
          }
          reject(new Error(`画像の読み込みに失敗しました: ${img.src}`));
        };

        img.addEventListener("load", finish, { once: true });
        img.addEventListener(
          "error",
          () => reject(new Error(`画像の読み込みに失敗しました: ${img.src}`)),
          { once: true },
        );
      });

      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch {
          // ignore
        }
      }
    }),
  );
}

async function inlineImagesForExport(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) {
        return;
      }

      const response = await fetch(src, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`画像の読み込みに失敗しました: ${src}`);
      }

      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }
          reject(new Error(`画像の読み込みに失敗しました: ${src}`));
        };
        reader.onerror = () =>
          reject(new Error(`画像の読み込みに失敗しました: ${src}`));
        reader.readAsDataURL(blob);
      });

      img.src = dataUrl;
      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch {
          // ignore
        }
      }
    }),
  );
}

export function logExportNodeMetrics(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  console.log({
    node: element,
    rect,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
  });
}

export function assertExportNodeReady(element: HTMLElement): void {
  logExportNodeMetrics(element);

  const rect = element.getBoundingClientRect();
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    element.scrollWidth <= 0 ||
    element.scrollHeight <= 0
  ) {
    throw new Error(
      "書き出し対象のサイズが0のため、画像化を中断しました。",
    );
  }
}

async function assertPngHasVisibleContent(dataUrl: string): Promise<void> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("書き出し結果の検証に失敗しました。"));
    image.src = dataUrl;
  });

  const sampleWidth = Math.min(image.width, 240);
  const sampleHeight = Math.min(image.height, 240);
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("書き出し結果の検証に失敗しました。");
  }

  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let nonWhitePixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha > 0 && (red < 248 || green < 248 || blue < 248)) {
      nonWhitePixels += 1;
      if (nonWhitePixels >= 24) {
        return;
      }
    }
  }

  throw new Error("書き出し結果が白紙のため、保存を中断しました。");
}

export async function generateComparisonImageBlob(
  element: HTMLElement,
  options: { width?: number; pixelRatio?: number } = {},
): Promise<Blob> {
  const pixelRatio = options.pixelRatio ?? 2;

  assertExportNodeReady(element);

  await waitForFonts();
  await waitForImages(element);
  await inlineImagesForExport(element);
  await waitForAnimationFrames(2);

  assertExportNodeReady(element);

  const width = element.scrollWidth || options.width || SNS_COMPARE_EXPORT_WIDTH_PX;
  const height = element.scrollHeight;

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: "#ffffff",
    skipFonts: false,
    width,
    height,
    canvasWidth: width * pixelRatio,
    canvasHeight: height * pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
      opacity: "1",
      visibility: "visible",
    },
  });

  await assertPngHasVisibleContent(dataUrl);

  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("画像の書き出しに失敗しました。");
  }

  return response.blob();
}

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

/** スマホで Web Share API（files）を使うべきか */
export function shouldUseWebShareForFiles(): boolean {
  if (typeof navigator === "undefined") return false;

  const mobileLike = isCoarsePointer() || isNarrowViewport();
  if (!mobileLike) return false;

  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;

  try {
    const testFile = new File([new Blob()], "test.png", { type: "image/png" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

export async function downloadPngBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export type SavePngBlobResult = "download" | "share" | "cancelled";

export async function savePngBlob(
  blob: Blob,
  filename: string,
): Promise<SavePngBlobResult> {
  const file = new File([blob], filename, { type: "image/png" });

  if (
    shouldUseWebShareForFiles() &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return "share";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  await downloadPngBlob(blob, filename);
  return "download";
}
