"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImportBatchJob } from "@/lib/admin/import-batch-job";
import {
  IMPORT_POPULAR_ADD_LIMIT,
  IMPORT_POPULAR_REQUEST_COUNT,
  IMPORT_POPULAR_TARGET_COUNT,
} from "@/lib/admin/import-constants";

type PopularCollectPanelProps = {
  currentCatalogCount: number;
  popularOffset: number;
  lastPopularStartOffset: number | null;
  disabled: boolean;
  onComplete: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
};

const ADD_LIMIT_OPTIONS = [50, 100, 200, 500, 1000] as const;
const REQUEST_OPTIONS = [10, 50, 200, 500] as const;

const secondaryButtonClassName =
  "inline-flex h-9 min-h-[36px] items-center rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

export function PopularCollectPanel({
  currentCatalogCount,
  popularOffset,
  lastPopularStartOffset,
  disabled,
  onComplete,
  onError,
  onRefresh,
}: PopularCollectPanelProps) {
  const [targetTotalCount, setTargetTotalCount] = useState(
    IMPORT_POPULAR_TARGET_COUNT,
  );
  const [startOffsetInput, setStartOffsetInput] = useState("");
  const [requestCount, setRequestCount] = useState(IMPORT_POPULAR_REQUEST_COUNT);
  const [addLimit, setAddLimit] = useState(IMPORT_POPULAR_ADD_LIMIT);
  const [offsetError, setOffsetError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [serverInProgress, setServerInProgress] = useState(false);
  const [job, setJob] = useState<ImportBatchJob | null>(null);
  const [collectOnly, setCollectOnly] = useState(false);

  const remaining = Math.max(0, targetTotalCount - currentCatalogCount);
  const savedNextOffset = popularOffset;

  const pollJob = useCallback(async () => {
    const response = await fetch("/api/admin/import/batch-job", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      job?: ImportBatchJob;
      inProgress?: boolean;
    };
    if (payload.job) setJob(payload.job);
    setServerInProgress(payload.inProgress === true);
    return payload;
  }, []);

  useEffect(() => {
    pollJob().catch(() => undefined);
    const timer = window.setInterval(() => {
      pollJob().catch(() => undefined);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [pollJob]);

  async function handleRun() {
    setIsRunning(true);
    setOffsetError(null);

    if (startOffsetInput.trim() !== "") {
      const numeric = Number(startOffsetInput);
      if (!Number.isInteger(numeric) || numeric < 0) {
        setOffsetError("開始offsetは0以上の整数で指定してください。");
        setIsRunning(false);
        return;
      }
    }

    const timer = window.setInterval(() => {
      pollJob().catch(() => undefined);
    }, 800);

    try {
      const response = await fetch("/api/admin/import/popular-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTotalCount,
          startOffset: startOffsetInput.trim() === "" ? "" : Number(startOffsetInput),
          requestCount,
          addLimit,
          maxBatches: 1,
          addAfterCollect: !collectOnly,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        job?: ImportBatchJob;
        collectResult?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "人気順バッチ収集に失敗しました。");
      }

      if (payload.job) setJob(payload.job);
      setStartOffsetInput("");
      await onRefresh();
      onComplete(
        payload.message ??
          payload.collectResult?.message ??
          "人気順バッチ収集が完了しました。",
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "人気順バッチ収集に失敗しました。",
      );
    } finally {
      window.clearInterval(timer);
      setIsRunning(false);
      pollJob().catch(() => undefined);
    }
  }

  const isActiveJob = serverInProgress || job?.status === "running";
  const isDisabled = disabled || isRunning || isActiveJob;

  return (
    <div className="rounded-xl border border-accent/30 bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-bold text-foreground">目標件数まで収集（人気順）</p>
          <p className="mt-1 text-xs text-muted">
            FANZA人気順から重複を除外しながら、500件単位で安全に追加します。1回の操作で1バッチのみ実行します。
          </p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <dt className="text-muted">現在の総作品数</dt>
            <dd className="text-lg font-bold">{currentCatalogCount.toLocaleString()}件</dd>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <dt className="text-muted">目標</dt>
            <dd className="text-lg font-bold">{targetTotalCount.toLocaleString()}件</dd>
          </div>
          <div className="rounded-lg bg-accent-light p-3">
            <dt className="text-muted">残り</dt>
            <dd className="text-lg font-bold text-accent">
              {remaining.toLocaleString()}件
            </dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">目標総作品数</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={targetTotalCount}
              onChange={(event) => setTargetTotalCount(Number(event.target.value))}
              disabled={isDisabled}
              className="h-11 w-full rounded-lg border border-border px-3"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">開始offset</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={startOffsetInput}
              onChange={(event) => {
                setStartOffsetInput(event.target.value);
                setOffsetError(null);
              }}
              disabled={isDisabled}
              placeholder={String(savedNextOffset)}
              className="h-11 w-full rounded-lg border border-border px-3"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">取得要求件数</span>
            <select
              value={requestCount}
              onChange={(event) => setRequestCount(Number(event.target.value))}
              disabled={isDisabled}
              className="h-11 w-full rounded-lg border border-border px-3"
            >
              {REQUEST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toLocaleString()}件
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">追加上限</span>
            <select
              value={addLimit}
              onChange={(event) => setAddLimit(Number(event.target.value))}
              disabled={isDisabled}
              className="h-11 w-full rounded-lg border border-border px-3"
            >
              {ADD_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.toLocaleString()}件
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-muted">
          保存済み次回offset：{savedNextOffset.toLocaleString()}
          {job?.runStats
            ? ` / 前回開始：${job.runStats.startOffset.toLocaleString()} / 次回：${job.runStats.nextOffset.toLocaleString()}`
            : null}
        </p>

        {offsetError ? (
          <p className="text-xs text-red-600">{offsetError}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              setStartOffsetInput(String(savedNextOffset));
              setOffsetError(null);
            }}
            className={secondaryButtonClassName}
          >
            次回offsetを入力
          </button>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              setStartOffsetInput("0");
              setOffsetError(null);
            }}
            className={secondaryButtonClassName}
          >
            0に戻す
          </button>
          <button
            type="button"
            disabled={isDisabled || lastPopularStartOffset == null}
            onClick={() => {
              if (lastPopularStartOffset == null) return;
              setStartOffsetInput(String(lastPopularStartOffset));
              setOffsetError(null);
            }}
            className={secondaryButtonClassName}
          >
            前回offsetに戻す
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={collectOnly}
              onChange={(event) => setCollectOnly(event.target.checked)}
              disabled={isDisabled}
            />
            候補取得のみ（追加しない）
          </label>
        </div>

        {isRunning || isActiveJob ? (
          <div className="rounded-lg border border-accent/30 bg-accent-light p-3 text-xs">
            <p className="font-semibold">
              {job
                ? `現在処理中です（${job.fetchedCount.toLocaleString()}件取得済み）`
                : "現在処理中です"}
            </p>
            {job ? (
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <p>
                  現在ページ：{job.currentPage.toLocaleString()} /{" "}
                  {job.plannedPages.toLocaleString()}
                </p>
                <p>現在offset：{job.currentOffset.toLocaleString()}</p>
                <p>取得済件数：{job.fetchedCount.toLocaleString()}件</p>
                <p>
                  残り推定件数：
                  {job.estimatedRemainingCount.toLocaleString()}件
                </p>
              </div>
            ) : null}
            {job?.phase === "validating" ? (
              <p>
                詳細取得中 {job.validatingProgress} / {job.validatingTotal}
              </p>
            ) : null}
            {job?.processId ? <p>処理ID：{job.processId}</p> : null}
          </div>
        ) : null}

        {job?.phase === "completed" && job.runStats ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p>追加成功：{job.runStats.addedCount.toLocaleString()}件</p>
            <p>掲載済み：{job.runStats.skippedExistingCount.toLocaleString()}件</p>
            <p>無効：{job.runStats.excludedCount.toLocaleString()}件</p>
            <p>失敗：{job.runStats.failedCount.toLocaleString()}件</p>
            <p>次回offset：{job.runStats.nextOffset.toLocaleString()}</p>
          </div>
        ) : null}

        {job?.status === "failed" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <p className="font-semibold">前回のバッチは異常終了しました。</p>
            <p>{job.progressMessage ?? job.errorCode ?? "原因不明"}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleRun}
          disabled={isDisabled}
          className={primaryButtonClassName}
        >
          {isRunning
            ? "実行中..."
            : isActiveJob
              ? `現在処理中です（${job?.fetchedCount.toLocaleString() ?? 0}件取得済み）`
            : collectOnly
              ? "人気順から候補を取得"
              : "人気順バッチを実行（取得→追加）"}
        </button>
      </div>
    </div>
  );
}
