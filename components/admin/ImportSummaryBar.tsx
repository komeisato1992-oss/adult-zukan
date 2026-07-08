"use client";

import type { ImportCandidatesSummary } from "@/lib/admin/import-candidate-types";

type ImportSummaryBarProps = {
  summary: ImportCandidatesSummary;
  visibleCount: number;
  displayedCount: number;
  isCollecting: boolean;
  onCollect: () => void;
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

export function ImportSummaryBar({
  summary,
  visibleCount,
  displayedCount,
  isCollecting,
  onCollect,
}: ImportSummaryBarProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
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
          </dl>
          <p className="text-xs text-muted">
            前回収集日時：{formatCollectedAt(summary.lastCollectedAt)}
            {displayedCount !== visibleCount
              ? ` / 現在表示 ${displayedCount.toLocaleString()} 件（品質フィルター適用中）`
              : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onCollect}
          disabled={isCollecting}
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {isCollecting ? "収集中..." : "候補を収集"}
        </button>
      </div>
    </div>
  );
}
