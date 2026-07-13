"use client";

import { useCallback, useEffect, useState } from "react";

type ImportJob = {
  id: string;
  jobType: "POPULAR_INITIAL_IMPORT" | "NEW_INITIAL_IMPORT";
  status: string;
  targetUniqueCount: number;
  currentUniqueCount: number;
  apiFetchedCount: number;
  apiSearchTotalCount?: number;
  newCreatedCount: number;
  updatedCount: number;
  duplicateCount: number;
  popularOverlapCount: number;
  existingDbDuplicateCount: number;
  skippedCount: number;
  errorCount: number;
  currentOffset: number;
  nextOffset: number;
  batchSize: number;
  sort: string;
  dryRun?: boolean;
  stopReason?: string;
  lastError?: string;
  startedAt?: string;
  completedAt?: string;
  lastProcessedAt?: string;
};

type ImportOverview = {
  popular: ImportJob | null;
  new: ImportJob | null;
  totalTarget: number;
  totalUniqueProgress: number;
  runningJobId: string | null;
  writeAllowed?: boolean;
  notice?: string;
  stats?: {
    workCount: number;
    circleCount: number;
    authorCount: number;
  };
};

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded bg-surface">
      <div
        className="h-full rounded bg-accent transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function JobCard({
  title,
  job,
  targetLabel,
  onStart,
  onResume,
  onPause,
  onCancel,
  busy,
  writeAllowed,
}: {
  title: string;
  job: ImportJob | null;
  targetLabel: string;
  onStart: (opts: { dryRun: boolean; target: number }) => void;
  onResume: () => void;
  onPause: () => void;
  onCancel: () => void;
  busy: boolean;
  writeAllowed: boolean;
}) {
  const [target, setTarget] = useState(job?.targetUniqueCount ?? 4000);
  useEffect(() => {
    if (job?.targetUniqueCount) setTarget(job.targetUniqueCount);
  }, [job?.targetUniqueCount]);

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="mt-1 text-xs text-muted">{targetLabel}</p>
        </div>
        {job ? (
          <span className="rounded bg-surface px-2 py-1 text-xs font-medium">
            {job.status}
            {job.dryRun ? " / dry-run" : ""}
          </span>
        ) : (
          <span className="text-xs text-muted">未開始</span>
        )}
      </div>

      {job ? (
        <>
          <p className="mt-3 text-sm font-medium">
            {job.currentUniqueCount.toLocaleString("ja-JP")} /{" "}
            {job.targetUniqueCount.toLocaleString("ja-JP")}
          </p>
          <ProgressBar
            current={job.currentUniqueCount}
            target={job.targetUniqueCount}
          />
          <ul className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>API取得: {job.apiFetchedCount.toLocaleString("ja-JP")}</li>
            <li>API総数: {job.apiSearchTotalCount?.toLocaleString("ja-JP") ?? "-"}</li>
            <li>新規: {job.newCreatedCount.toLocaleString("ja-JP")}</li>
            <li>更新: {job.updatedCount.toLocaleString("ja-JP")}</li>
            <li>重複: {job.duplicateCount.toLocaleString("ja-JP")}</li>
            <li>人気重複: {job.popularOverlapCount.toLocaleString("ja-JP")}</li>
            <li>既存重複: {job.existingDbDuplicateCount.toLocaleString("ja-JP")}</li>
            <li>スキップ: {job.skippedCount.toLocaleString("ja-JP")}</li>
            <li>エラー: {job.errorCount.toLocaleString("ja-JP")}</li>
            <li>
              offset: {job.currentOffset} → {job.nextOffset}
            </li>
            <li>sort: {job.sort}</li>
            <li>batch: {job.batchSize}</li>
          </ul>
          {job.stopReason ? (
            <p className="mt-2 text-xs text-amber-700">停止理由: {job.stopReason}</p>
          ) : null}
          {job.lastError ? (
            <p className="mt-1 text-xs text-red-700">{job.lastError}</p>
          ) : null}
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          目標件数
          <input
            type="number"
            min={1}
            value={target}
            disabled={!writeAllowed || busy}
            onChange={(e) => setTarget(Number(e.target.value) || 1)}
            className="mt-1 w-28 rounded border border-border px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={!writeAllowed || busy}
          onClick={() => onStart({ dryRun: true, target })}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
        >
          dry-run開始
        </button>
        <button
          type="button"
          disabled={!writeAllowed || busy}
          onClick={() => onStart({ dryRun: false, target })}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          本登録開始
        </button>
        <button
          type="button"
          disabled={!writeAllowed || busy}
          onClick={onResume}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
        >
          再開
        </button>
        <button
          type="button"
          disabled={!writeAllowed || busy}
          onClick={onPause}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
        >
          一時停止
        </button>
        <button
          type="button"
          disabled={!writeAllowed || busy}
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
        >
          停止
        </button>
      </div>
    </section>
  );
}

export function DoujinImportClient() {
  const [overview, setOverview] = useState<ImportOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/doujin/import");
    if (!response.ok) return;
    const json = (await response.json()) as ImportOverview;
    setOverview(json);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const jobId = overview?.runningJobId;
    if (!jobId || overview?.writeAllowed === false) return;
    let cancelled = false;

    async function tickLoop() {
      let currentJobId = jobId;
      while (!cancelled && currentJobId) {
        try {
          const response = await fetch("/api/admin/doujin/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "tick",
              jobId: currentJobId,
            }),
          });
          const json = await response.json();
          if (response.status === 403) {
            setError(json.message || "書き込みが禁止されています");
            break;
          }
          if (!response.ok) {
            setError(json.error || "tick failed");
            break;
          }
          setOverview(json);
          if (!json.continueRunning) break;
          if (json.job?.status && json.job.status !== "RUNNING") break;
          currentJobId = json.runningJobId ?? currentJobId;
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          break;
        }
        await new Promise((r) => window.setTimeout(r, 300));
      }
      if (!cancelled) await refresh();
    }

    void tickLoop();
    return () => {
      cancelled = true;
    };
  }, [overview?.runningJobId, overview?.writeAllowed, refresh]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/doujin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (response.status === 403) {
        throw new Error(json.message || "書き込みが禁止されています");
      }
      if (!response.ok) throw new Error(json.error || "操作に失敗しました");
      setOverview(json);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const popular = overview?.popular ?? null;
  const neu = overview?.new ?? null;
  const totalProgress = overview?.totalUniqueProgress ?? 0;
  const totalTarget = overview?.totalTarget ?? 5000;
  const writeAllowed = overview?.writeAllowed !== false;

  return (
    <div className="space-y-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div>
        <h2 className="text-lg font-bold">初期5,000作品導入</h2>
        <p className="mt-1 text-sm text-muted">
          人気順4,000件 + 新着純増1,000件。1回あたり最大500件ずつ処理し、進捗保存後に続行します。
        </p>
        {!writeAllowed ? (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              本番環境では作品データの直接更新はできません。
            </p>
            <p className="mt-1">
              ローカル環境で同期を実行し、JSONをGitへコミット・pushしてください。
            </p>
          </div>
        ) : (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            大量取得は500件ずつ実行されます。処理中に同じジョブを重複実行しないでください。
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <p className="text-sm font-medium">全体進捗</p>
        <p className="mt-1 text-2xl font-bold">
          {totalProgress.toLocaleString("ja-JP")} /{" "}
          {totalTarget.toLocaleString("ja-JP")}
        </p>
        <ProgressBar current={totalProgress} target={totalTarget} />
        <ul className="mt-3 space-y-1 text-xs text-muted">
          <li>
            人気順{" "}
            {(popular?.currentUniqueCount ?? 0).toLocaleString("ja-JP")} /{" "}
            {(popular?.targetUniqueCount ?? 4000).toLocaleString("ja-JP")}{" "}
            {popular?.status === "COMPLETED" ? "完了" : popular?.status ?? "未開始"}
          </li>
          <li>
            新着純増{" "}
            {(neu?.currentUniqueCount ?? 0).toLocaleString("ja-JP")} /{" "}
            {(neu?.targetUniqueCount ?? 1000).toLocaleString("ja-JP")}{" "}
            {neu?.status === "COMPLETED" ? "完了" : neu?.status ?? "未開始"}
          </li>
          <li>カタログ作品数: {overview?.stats?.workCount ?? "-"}</li>
        </ul>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <JobCard
          title="人気順インポート"
          job={popular}
          targetLabel="目標: ユニーク4,000件（sort=rank）"
          busy={busy}
          writeAllowed={writeAllowed}
          onStart={({ dryRun, target }) =>
            void post({
              action: "start",
              jobType: "POPULAR_INITIAL_IMPORT",
              dryRun,
              targetUniqueCount: target,
              site: "FANZA",
              service: "doujin",
              floor: "digital_doujin",
            })
          }
          onResume={() =>
            void post({
              action: "resume",
              jobType: "POPULAR_INITIAL_IMPORT",
            })
          }
          onPause={() => void post({ action: "pause", jobId: popular?.id })}
          onCancel={() => void post({ action: "cancel", jobId: popular?.id })}
        />
        <JobCard
          title="新着順インポート"
          job={neu}
          targetLabel="目標: 純増1,000件（sort=date / 人気・既存除外）"
          busy={busy}
          writeAllowed={writeAllowed}
          onStart={({ dryRun, target }) =>
            void post({
              action: "start",
              jobType: "NEW_INITIAL_IMPORT",
              dryRun,
              targetUniqueCount: target,
              site: "FANZA",
              service: "doujin",
              floor: "digital_doujin",
            })
          }
          onResume={() =>
            void post({
              action: "resume",
              jobType: "NEW_INITIAL_IMPORT",
            })
          }
          onPause={() => void post({ action: "pause", jobId: neu?.id })}
          onCancel={() => void post({ action: "cancel", jobId: neu?.id })}
        />
      </div>
    </div>
  );
}
