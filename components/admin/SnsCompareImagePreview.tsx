"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { SnsCompareWorkMini } from "@/lib/admin/sns-types";
import { buildImageProxyUrl } from "@/lib/image-proxy";
import { siteConfig } from "@/lib/site-config";
import { isValidImageUrl } from "@/lib/works";

type SnsCompareImagePreviewProps = {
  works: [SnsCompareWorkMini, SnsCompareWorkMini];
  compareUrl: string;
};

function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));

  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve, reject) => {
          const finish = () => {
            if (img.naturalWidth > 0) {
              resolve();
              return;
            }
            reject(new Error("画像の読み込みに失敗しました。"));
          };

          if (img.complete) {
            finish();
            return;
          }

          img.addEventListener("load", finish, { once: true });
          img.addEventListener(
            "error",
            () => {
              reject(new Error("画像の読み込みに失敗しました。"));
            },
            { once: true },
          );
        }),
    ),
  ).then(() => undefined);
}

function CompareImageWorkColumn({
  label,
  work,
}: {
  label: string;
  work: SnsCompareWorkMini;
}) {
  const [imageError, setImageError] = useState(false);
  const originalUrl =
    isValidImageUrl(work.imageUrl) && work.imageUrl ? work.imageUrl : undefined;
  const proxyUrl = originalUrl ? buildImageProxyUrl(originalUrl) : undefined;

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col border border-border bg-white">
      <div className="border-b border-border bg-accent-light px-3 py-2 text-center text-xs font-bold text-accent">
        {label}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="sns-compare-package-frame relative mx-auto h-[187px] w-[140px] overflow-hidden rounded-md border border-border bg-surface">
          {proxyUrl && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyUrl}
              alt={work.title}
              onError={() => setImageError(true)}
              className="absolute right-0 top-0"
              style={{
                height: "100%",
                width: "auto",
                maxWidth: "none",
              }}
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
        <div className="mt-3 min-w-0 space-y-1.5 break-words text-[11px] leading-relaxed text-foreground">
          <p className="line-clamp-3 text-xs font-bold">{work.title}</p>
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

export function SnsCompareImagePreview({
  works,
  compareUrl,
}: SnsCompareImagePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function handleExport() {
    if (!previewRef.current) return;

    setExporting(true);
    setExportError("");

    try {
      await waitForImages(previewRef.current);

      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `compare-${works[0].contentId}-${works[1].contentId}.png`;
      link.href = dataUrl;
      link.click();
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

      <div className="w-full max-w-full overflow-hidden rounded-lg border border-border bg-surface p-2 sm:p-3">
        <div
          ref={previewRef}
          className="mx-auto w-full max-w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm sm:max-w-[720px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteConfig.logoIcon}
                alt={siteConfig.name}
                width={28}
                height={28}
                className="h-7 w-7 shrink-0"
              />
              <span className="truncate text-sm font-bold text-foreground">
                {siteConfig.name}
              </span>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
              似ている作品を比較して選べる
            </span>
          </div>

          <p className="border-b border-border bg-white px-3 py-2 text-center text-xs text-muted sm:px-4">
            アダルト図鑑では、似ている作品を比較できます
          </p>

          <div className="grid grid-cols-1 gap-3 bg-surface p-3 sm:grid-cols-2">
            <CompareImageWorkColumn label="作品A" work={works[0]} />
            <CompareImageWorkColumn label="作品B" work={works[1]} />
          </div>

          <div className="break-all border-t border-border bg-accent-light px-3 py-2 text-center text-[11px] text-muted sm:px-4">
            {compareUrl}
          </div>
        </div>
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
          PNG形式で保存できます。X投稿時は手動で添付してください。
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
