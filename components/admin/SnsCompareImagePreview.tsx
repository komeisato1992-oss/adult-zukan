"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { SnsCompareWorkMini } from "@/lib/admin/sns-types";
import { buildImageProxyUrl } from "@/lib/image-proxy";
import { siteConfig } from "@/lib/site-config";
import { isValidImageUrl } from "@/lib/works";

/** 書き出し専用固定幅（PC・スマホ共通） */
const EXPORT_WIDTH_PX = 1200;

type SnsCompareImagePreviewProps = {
  works: [SnsCompareWorkMini, SnsCompareWorkMini];
  compareUrl: string;
};

type CompareLayout = "preview" | "export";

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

function ComparePackageImage({
  work,
  layout,
}: {
  work: SnsCompareWorkMini;
  layout: CompareLayout;
}) {
  const [imageError, setImageError] = useState(false);
  const originalUrl =
    isValidImageUrl(work.imageUrl) && work.imageUrl ? work.imageUrl : undefined;
  const proxyUrl = originalUrl ? buildImageProxyUrl(originalUrl) : undefined;

  const frameClass =
    layout === "export"
      ? "relative mx-auto h-[320px] w-[240px] overflow-hidden rounded-md border border-border bg-surface"
      : "relative mx-auto h-[187px] w-[140px] overflow-hidden rounded-md border border-border bg-surface";

  return (
    <div className={frameClass}>
      {proxyUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyUrl}
          alt={work.title}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover object-right"
          crossOrigin="anonymous"
        />
      ) : imageError ? (
        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] leading-relaxed text-red-600">
          画像の読み込みに失敗しました
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-muted">
          画像なし
        </div>
      )}
    </div>
  );
}

function CompareImageWorkColumn({
  label,
  work,
  layout,
}: {
  label: string;
  work: SnsCompareWorkMini;
  layout: CompareLayout;
}) {
  const isExport = layout === "export";
  const labelClass = isExport
    ? "border-b border-border bg-accent-light px-4 py-2.5 text-center text-sm font-bold text-accent"
    : "border-b border-border bg-accent-light px-3 py-2 text-center text-xs font-bold text-accent";
  const bodyClass = isExport ? "flex min-w-0 flex-1 flex-col p-4" : "flex min-w-0 flex-1 flex-col p-3";
  const titleClass = isExport
    ? "line-clamp-3 text-sm font-bold"
    : "line-clamp-3 text-xs font-bold";
  const metaClass = isExport
    ? "mt-4 min-w-0 space-y-2 break-words text-sm leading-relaxed text-foreground"
    : "mt-3 min-w-0 space-y-1.5 break-words text-[11px] leading-relaxed text-foreground";

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col border border-border bg-white">
      <div className={labelClass}>{label}</div>
      <div className={bodyClass}>
        <ComparePackageImage work={work} layout={layout} />
        <div className={metaClass}>
          <p className={titleClass}>{work.title}</p>
          <p>
            <span className="text-muted">女優：</span>
            {work.actressNames || "-"}
          </p>
          <p>
            <span className="text-muted">価格：</span>
            {work.price || "-"}
          </p>
          <p>
            <span className="text-muted">発売日：</span>
            {work.releaseDate || "-"}
          </p>
          <p>
            <span className="text-muted">再生時間：</span>
            {work.duration || "-"}
          </p>
          <p className="line-clamp-2">
            <span className="text-muted">ジャンル：</span>
            {work.genres || "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompareCardBody({
  works,
  compareUrl,
  layout,
}: {
  works: [SnsCompareWorkMini, SnsCompareWorkMini];
  compareUrl: string;
  layout: CompareLayout;
}) {
  const isExport = layout === "export";

  return (
    <>
      <div
        className={
          isExport
            ? "flex items-center justify-between gap-3 border-b border-border bg-white px-6 py-4"
            : "flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-3 sm:px-4"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteConfig.logoIcon}
            alt={siteConfig.name}
            width={isExport ? 36 : 28}
            height={isExport ? 36 : 28}
            className={isExport ? "h-9 w-9 shrink-0" : "h-7 w-7 shrink-0"}
          />
          <span
            className={
              isExport
                ? "truncate text-lg font-bold text-foreground"
                : "truncate text-sm font-bold text-foreground"
            }
          >
            {siteConfig.name}
          </span>
        </div>
        <span
          className={
            isExport
              ? "shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white"
              : "rounded-full bg-accent px-3 py-1 text-xs font-bold text-white"
          }
        >
          似ている作品を比較して選べる
        </span>
      </div>

      <p
        className={
          isExport
            ? "border-b border-border bg-white px-6 py-3 text-center text-sm text-muted"
            : "border-b border-border bg-white px-3 py-2 text-center text-xs text-muted sm:px-4"
        }
      >
        アダルト図鑑では、似ている作品を比較できます
      </p>

      <div
        className={
          isExport
            ? "grid grid-cols-2 gap-4 bg-surface p-4"
            : "grid grid-cols-1 gap-3 bg-surface p-3 sm:grid-cols-2"
        }
      >
        <CompareImageWorkColumn label="作品A" work={works[0]} layout={layout} />
        <CompareImageWorkColumn label="作品B" work={works[1]} layout={layout} />
      </div>

      <div
        className={
          isExport
            ? "break-all border-t border-border bg-accent-light px-6 py-3 text-center text-sm text-muted"
            : "break-all border-t border-border bg-accent-light px-3 py-2 text-center text-[11px] text-muted sm:px-4"
        }
      >
        {compareUrl}
      </div>
    </>
  );
}

async function savePngBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function SnsCompareImagePreview({
  works,
  compareUrl,
}: SnsCompareImagePreviewProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function handleExport() {
    if (!exportRef.current || exporting) return;

    setExporting(true);
    setExportError("");

    const filename = `compare-${works[0].contentId}-${works[1].contentId}.png`;

    try {
      await waitForFonts();
      await waitForImages(exportRef.current);

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: EXPORT_WIDTH_PX,
        style: {
          width: `${EXPORT_WIDTH_PX}px`,
        },
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await savePngBlob(blob, filename);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "画像の書き出しに失敗しました。";

      if (message.includes("読み込み")) {
        setExportError(
          "画像の読み込みに失敗しました。プレビュー内の画像を確認して再試行してください。",
        );
      } else {
        setExportError(
          "画像の書き出しに失敗しました。CORSの可能性があります。再試行してください。",
        );
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden">
      <p className="text-sm font-semibold text-foreground">比較画像プレビュー</p>

      {/* 画面表示用（レスポンシブ） */}
      <div className="w-full max-w-full overflow-hidden rounded-lg border border-border bg-surface p-2 sm:p-3">
        <div className="mx-auto w-full max-w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm sm:max-w-[720px]">
          <CompareCardBody works={works} compareUrl={compareUrl} layout="preview" />
        </div>
      </div>

      {/* 書き出し専用（固定幅・常に2カラム・画面外配置） */}
      <div
        ref={exportRef}
        aria-hidden="true"
        className="pointer-events-none overflow-hidden rounded-lg border border-border bg-white"
        style={{
          width: `${EXPORT_WIDTH_PX}px`,
          position: "fixed",
          left: "-99999px",
          top: 0,
          zIndex: -1,
        }}
      >
        <CompareCardBody works={works} compareUrl={compareUrl} layout="export" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-accent bg-white px-3 text-sm font-medium text-accent transition-colors hover:bg-accent-light disabled:opacity-60"
        >
          {exporting ? "書き出し中..." : "画像を書き出し"}
        </button>
        <p className="text-xs text-muted">
          PNG形式で保存できます。スマホでは共有シートが開く場合があります。
        </p>
      </div>

      {exportError ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-xs text-red-600">{exportError}</p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            再試行
          </button>
        </div>
      ) : null}
    </div>
  );
}
