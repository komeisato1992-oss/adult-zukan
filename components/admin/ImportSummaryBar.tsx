"use client";

import type { ImportCandidatesSummary } from "@/lib/admin/import-candidate-types";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import type { ImportCollectProgress } from "@/lib/admin/import-collect-progress";
import {
  IMPORT_COLLECT_REQUEST_COUNT,
  IMPORT_COLLECT_REQUEST_OPTIONS,
} from "@/lib/admin/import-constants";

export type ImportCollectParams = {
  requestCount: number;
  startOffset: number | null;
};

type ImportSummaryBarProps = {
  summary: ImportCandidatesSummary;
  visibleCount: number;
  displayedCount: number;
  collectingMode: ImportCollectionMode | null;
  collectProgress: ImportCollectProgress | null;
  requestCount: number;
  startOffsetInput: string;
  offsetError: string | null;
  onRequestCountChange: (value: number) => void;
  onStartOffsetInputChange: (value: string) => void;
  onUseNextOffset: () => void;
  onResetOffset: () => void;
  onUsePreviousOffset: () => void;
  onCollect: (mode: ImportCollectionMode, params: ImportCollectParams) => void;
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

const secondaryButtonClassName =
  "inline-flex h-9 min-h-[36px] items-center rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

export function ImportSummaryBar({
  summary,
  visibleCount,
  displayedCount,
  collectingMode,
  collectProgress,
  requestCount,
  startOffsetInput,
  offsetError,
  onRequestCountChange,
  onStartOffsetInputChange,
  onUseNextOffset,
  onResetOffset,
  onUsePreviousOffset,
  onCollect,
}: ImportSummaryBarProps) {
  const isCollecting = collectingMode !== null;
  const collectionState = summary.collectionState;

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
                保存済み {collectionState.pastOffset.toLocaleString()} / 次回{" "}
                {collectionState.nextPastOffset.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted">周回数</dt>
              <dd className="font-semibold text-foreground">
                {collectionState.cycleCount.toLocaleString()}回
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

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[16rem]">
          <div className="space-y-2 rounded-lg border border-border bg-gray-50 p-3">
            <label className="block text-xs font-semibold text-foreground">
              取得要求件数
            </label>
            <select
              value={requestCount}
              onChange={(event) => onRequestCountChange(Number(event.target.value))}
              disabled={isCollecting}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {IMPORT_COLLECT_REQUEST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toLocaleString()}件
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              デフォルト {IMPORT_COLLECT_REQUEST_COUNT.toLocaleString()}件（API
              1回上限100件のため複数ページ取得）
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-gray-50 p-3">
            <label
              htmlFor="past-start-offset"
              className="block text-xs font-semibold text-foreground"
            >
              開始offset（過去作品）
            </label>
            <input
              id="past-start-offset"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={startOffsetInput}
              onChange={(event) => onStartOffsetInputChange(event.target.value)}
              disabled={isCollecting}
              placeholder={String(collectionState.nextPastOffset)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-xs text-muted">
              空欄の場合は保存済み次回offset（
              {collectionState.nextPastOffset.toLocaleString()}）を使用。0は先頭から。
            </p>
            {offsetError ? (
              <p className="text-xs text-red-600">{offsetError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onUseNextOffset}
                disabled={isCollecting}
                className={secondaryButtonClassName}
              >
                次回offsetを入力
              </button>
              <button
                type="button"
                onClick={onResetOffset}
                disabled={isCollecting}
                className={secondaryButtonClassName}
              >
                0に戻す
              </button>
              <button
                type="button"
                onClick={onUsePreviousOffset}
                disabled={
                  isCollecting || collectionState.lastPastStartOffset == null
                }
                className={secondaryButtonClassName}
              >
                前回offsetに戻す
              </button>
            </div>
          </div>

          {isCollecting && collectProgress ? (
            <div className="rounded-lg border border-accent/30 bg-accent-light p-3 text-xs text-foreground">
              <p>
                取得中 {collectProgress.currentPage} / {collectProgress.plannedPages}
                ページ
              </p>
              <p>
                取得済み {collectProgress.apiFetchedCount.toLocaleString()} /{" "}
                {collectProgress.requestedCount.toLocaleString()}件
              </p>
              {collectingMode === "past" ? (
                <p>
                  開始offset {collectProgress.startOffset.toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              onCollect("new", {
                requestCount,
                startOffset: null,
              })
            }
            disabled={isCollecting}
            className={`${buttonClassName} bg-accent hover:bg-accent-hover`}
          >
            {collectingMode === "new" ? "新作収集中..." : "新作を収集"}
          </button>
          <button
            type="button"
            onClick={() =>
              onCollect("past", {
                requestCount,
                startOffset:
                  startOffsetInput.trim() === ""
                    ? null
                    : Number(startOffsetInput),
              })
            }
            disabled={isCollecting}
            className={`${buttonClassName} border border-accent bg-white text-accent hover:bg-accent-light`}
          >
            {collectingMode === "past"
              ? "過去作品収集中..."
              : "過去作品を収集"}
          </button>
        </div>
      </div>
    </div>
  );
}
