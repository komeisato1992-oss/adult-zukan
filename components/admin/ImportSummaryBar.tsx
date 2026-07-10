"use client";

import type { ImportCandidatesSummary } from "@/lib/admin/import-candidate-types";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";

type ImportSummaryBarProps = {
  summary: ImportCandidatesSummary;
  visibleCount: number;
  displayedCount: number;
  collectingMode: ImportCollectionMode | null;
  onCollect: (mode: ImportCollectionMode) => void;
};

function formatCollectedAt(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(date).replace(/\//g, "/");
}

const buttonClassName =
  "inline-flex h-11 min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function ImportSummaryBar({
  summary,
  visibleCount,
  displayedCount,
  collectingMode,
  onCollect,
}: ImportSummaryBarProps) {
  const isCollecting = collectingMode !== null;

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-bold text-foreground">未掲載候補サマリー</p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">総カタログ件数</dt>
              <dd className="font-semibold text-foreground">
                {summary.catalogTotalCount.toLocaleString()}件
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">掲載作品数</dt>
              <dd className="font-semibold text-foreground">
                {summary.publishedCount.toLocaleString()}件
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">未掲載候補</dt>
              <dd className="font-semibold text-accent">
                {visibleCount.toLocaleString()}件
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">追加済み候補</dt>
              <dd className="font-semibold text-foreground">
                {summary.addedCount.toLocaleString()}件
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">除外候補</dt>
              <dd className="font-semibold text-foreground">
                {summary.excludedCount.toLocaleString()}件
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">過去作品offset</dt>
              <dd className="font-semibold text-foreground">
                現在 {summary.collectionState.pastOffset.toLocaleString()} / 次回{" "}
                {summary.collectionState.nextPastOffset.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">周回数</dt>
              <dd className="font-semibold text-foreground">
                {summary.collectionState.cycleCount.toLocaleString()}回
              </dd>
            </div>
          </dl>
          <div className="space-y-1 text-xs text-muted">
            <p>新作収集 最終実行：{formatCollectedAt(summary.lastNewCollectedAt)}</p>
            <p>過去作品収集 最終実行：{formatCollectedAt(summary.lastPastCollectedAt)}</p>
            <p>前回収集日時：{formatCollectedAt(summary.lastCollectedAt)}</p>
            {displayedCount !== visibleCount ? (
              <p>
                現在表示 {displayedCount.toLocaleString()} 件（品質フィルター適用中）
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[12rem]">
          <button
            type="button"
            onClick={() => onCollect("new")}
            disabled={isCollecting}
            className={`${buttonClassName} bg-accent hover:bg-accent-hover`}
          >
            {collectingMode === "new" ? "新作収集中..." : "新作を収集"}
          </button>
          <button
            type="button"
            onClick={() => onCollect("past")}
            disabled={isCollecting}
            className={`${buttonClassName} border border-accent bg-white text-accent hover:bg-accent-light`}
          >
            {collectingMode === "past" ? "過去作品収集中..." : "過去作品を収集"}
          </button>
        </div>
      </div>
    </div>
  );
}
