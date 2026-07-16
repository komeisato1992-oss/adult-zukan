"use client";

import { useCallback, useEffect, useState } from "react";

type MigrationJob = {
  jobId: string;
  status: string;
  batchSize: number;
  cursor: number;
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
  supabaseCountBefore: number;
  supabaseOverlapBefore: number;
  targetCount: number;
  processedCount: number;
  addedCount: number;
  updatedCount: number;
  duplicateCount: number;
  failedCount: number;
  lastProcessedCid: string | null;
  stopReason: string | null;
  message: string | null;
  totalDurationMs: number;
  estimatedRemainingMs: number | null;
  supabaseCountAfter: number | null;
  startedAt: string | null;
  completedAt: string | null;
};

type Preview = {
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
  supabaseCountBefore: number;
  supabaseOverlapBefore: number;
  supabaseConfigured: boolean;
};

type StatusResponse = {
  success: boolean;
  preview?: Preview;
  job?: MigrationJob | null;
  statusLabel?: string;
  progressPercent?: number;
  remainingCount?: number;
  estimatedRemainingMs?: number | null;
  error?: string;
};

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}秒`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}分${rem}秒`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function WorksMasterMigrationPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [job, setJob] = useState<MigrationJob | null>(null);
  const [statusLabel, setStatusLabel] = useState("未開始");
  const [progressPercent, setProgressPercent] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState<number | null>(
    null,
  );

  const applyStatus = useCallback((data: StatusResponse) => {
    if (data.preview) setPreview(data.preview);
    setJob(data.job ?? null);
    setStatusLabel(data.statusLabel ?? "未開始");
    setProgressPercent(data.progressPercent ?? 0);
    setRemainingCount(data.remainingCount ?? 0);
    setEstimatedRemainingMs(data.estimatedRemainingMs ?? null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/works-master-migration/status", {
        cache: "no-store",
      });
      const data = (await response.json()) as StatusResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "ステータス取得に失敗しました");
      }
      applyStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const processOneBatch = useCallback(async (): Promise<{
    done: boolean;
    stopped: boolean;
  }> => {
    const response = await fetch("/api/admin/works-master-migration/process", {
      method: "POST",
    });
    const data = (await response.json()) as StatusResponse & {
      done?: boolean;
      stopped?: boolean;
      job?: MigrationJob;
    };
    if (!response.ok || !data.success) {
      throw new Error(data.error || "バッチ処理に失敗しました");
    }
    if (data.job) setJob(data.job);
    setProgressPercent(data.progressPercent ?? 0);
    setRemainingCount(data.remainingCount ?? 0);
    setEstimatedRemainingMs(data.estimatedRemainingMs ?? null);
    setStatusLabel(
      data.job?.status === "completed"
        ? "完了"
        : data.job?.status === "stopped"
          ? "安全停止"
          : data.job?.status === "running"
            ? "実行中"
            : statusLabel,
    );
    return {
      done: Boolean(data.done),
      stopped: Boolean(data.stopped),
    };
  }, [statusLabel]);

  const runUntilDone = useCallback(async () => {
    setAutoRunning(true);
    setBusy(true);
    setError(null);
    try {
      for (;;) {
        const result = await processOneBatch();
        if (result.done || result.stopped) break;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refresh();
    } finally {
      setAutoRunning(false);
      setBusy(false);
    }
  }, [processOneBatch, refresh]);

  const handleStart = async (forceRestart = false) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/works-master-migration/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 100, forceRestart }),
      });
      const data = (await response.json()) as StatusResponse & {
        job?: MigrationJob;
        preview?: Preview;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "開始に失敗しました");
      }
      if (data.preview) setPreview(data.preview);
      if (data.job) setJob(data.job);
      setStatusLabel("実行中");
      await runUntilDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/works-master-migration/resume", {
        method: "POST",
      });
      const data = (await response.json()) as StatusResponse & { job?: MigrationJob };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "再開に失敗しました");
      }
      if (data.job) setJob(data.job);
      setStatusLabel("実行中");
      await runUntilDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const resumable =
    job &&
    ["paused", "stopped", "failed", "running"].includes(job.status) &&
    job.processedCount < job.targetCount;

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            作品マスター一括移行（第5段階）
          </h2>
          <p className="mt-1 text-sm text-muted">
            既存JSONの全作品を Supabase works へ CID upsert。JSONはフォールバックとして残します。Git差分・デプロイなし。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy || loading}
          className="min-h-[40px] rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
        >
          更新
        </button>
      </div>

      {loading && !preview ? (
        <p className="mt-4 text-sm text-muted">読込中…</p>
      ) : (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>
            移行状況: <span className="font-bold">{statusLabel}</span>
            {autoRunning ? "（バッチ実行中）" : ""}
          </p>
          <p>
            総対象件数:{" "}
            {(job?.targetCount ?? preview?.jsonUniqueCidCount ?? 0).toLocaleString()}
          </p>
          <p>
            完了件数: {(job?.processedCount ?? 0).toLocaleString()}
            {` / ${progressPercent}%`}
          </p>
          <p>追加件数: {(job?.addedCount ?? 0).toLocaleString()}</p>
          <p>更新件数: {(job?.updatedCount ?? 0).toLocaleString()}</p>
          <p>
            重複件数:{" "}
            {(job?.duplicateCount ?? preview?.jsonDuplicateCidCount ?? 0).toLocaleString()}
          </p>
          <p>失敗件数: {(job?.failedCount ?? 0).toLocaleString()}</p>
          <p>残り件数: {remainingCount.toLocaleString()}</p>
          <p>推定残り時間: {formatDuration(estimatedRemainingMs ?? job?.estimatedRemainingMs)}</p>
          <p className="sm:col-span-2">
            最終処理CID: {job?.lastProcessedCid ?? "—"}
          </p>
          <p>総実行時間: {formatDuration(job?.totalDurationMs)}</p>
          <p>開始: {formatDateTime(job?.startedAt)}</p>
          <p>完了: {formatDateTime(job?.completedAt)}</p>
        </div>
      )}

      {preview ? (
        <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
          <p>
            移行前確認 — JSON {preview.jsonTotalCount.toLocaleString()}件 /
            ユニークCID {preview.jsonUniqueCidCount.toLocaleString()}件 /
            JSON内重複 {preview.jsonDuplicateCidCount.toLocaleString()}件 /
            Supabase既存 {preview.supabaseCountBefore.toLocaleString()}件 /
            CID重複（既存） {preview.supabaseOverlapBefore.toLocaleString()}件
          </p>
          {job?.supabaseCountAfter != null ? (
            <p className="mt-1">
              移行後 Supabase件数: {job.supabaseCountAfter.toLocaleString()}件
            </p>
          ) : null}
          {job?.message ? <p className="mt-1 font-medium">{job.message}</p> : null}
          {job?.stopReason ? (
            <p className="mt-1 text-amber-800">停止理由: {job.stopReason}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !preview?.supabaseConfigured}
          onClick={() => void handleStart(false)}
          className="min-h-[44px] rounded-xl bg-sky-600 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          移行開始（100件バッチ）
        </button>
        <button
          type="button"
          disabled={busy || !resumable}
          onClick={() => void handleResume()}
          className="min-h-[44px] rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          途中再開
        </button>
        <button
          type="button"
          disabled={busy || !preview?.supabaseConfigured}
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              !window.confirm("未完了ジョブを破棄して最初からやり直しますか？")
            ) {
              return;
            }
            void handleStart(true);
          }}
          className="min-h-[44px] rounded-xl border border-amber-400 bg-amber-50 px-4 text-sm font-bold text-amber-950 disabled:opacity-50"
        >
          強制再開始
        </button>
        <a
          href="/api/admin/works-master-migration/errors"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          エラーCSV出力
        </a>
      </div>
    </section>
  );
}
