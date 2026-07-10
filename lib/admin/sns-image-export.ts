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

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));

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
          reject(new Error("画像の読み込みに失敗しました。"));
        };

        img.addEventListener("load", finish, { once: true });
        img.addEventListener(
          "error",
          () => reject(new Error("画像の読み込みに失敗しました。")),
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

export async function generateComparisonImageBlob(
  element: HTMLElement,
  options: { width?: number; pixelRatio?: number } = {},
): Promise<Blob> {
  const width = options.width ?? SNS_COMPARE_EXPORT_WIDTH_PX;
  const pixelRatio = options.pixelRatio ?? 2;

  await waitForFonts();
  await waitForImages(element);

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: "#ffffff",
    width,
    style: {
      width: `${width}px`,
    },
  });

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
    URL.revokeObjectURL(url);
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
