"use client";

import { useCallback, useEffect, useState } from "react";

type SyncJob = {
  id: string;
  mode: "light" | "full";
  status: string;
  apiFetchedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  errorCount: number;
  currentOffset: number;
  nextOffset: number;
  batchSize: number;
  dryRun?: boolean;
  estimatedJsonSaves?: number;
  rawShardsTouched?: string[];
  changedFields?: string[];
  stopReason?: string;
  lastError?: string;
};

type SyncOverview = {
  light: SyncJob | null;
  full: SyncJob | null;
  runningJobId: string | null;
  writeAllowed: boolean;
  lightEnabled: boolean;
  fullEnabled: boolean;
  isVercel?: boolean;
  expectedFields?: { light: string[]; full: string[] };
  notice?: string;
};

function JobPanel({
  title,
  description,
  warning,
  disabledReason,
  job,
  mode,
  disabled,
  busy,
  onStart,
  onResume,
  onPause,
  onCancel,
}: {
  title: string;
  description: string;
  warning?: string;
  disabledReason?: string | null;
  job: SyncJob | null;
  mode: "light" | "full";
  disabled: boolean;
  busy: boolean;
  onStart: (opts: { dryRun: boolean }) => void;
  onResume: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="mt-1 text-xs text-muted">{description}</p>
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

      {warning ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warning}
        </p>
      ) : null}

      {disabledReason ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-pre-line">
          {disabledReason}
        </p>
      ) : null}

      {job ? (
        <ul className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
          <li>API取得: {job.apiFetchedCount.toLocaleString("ja-JP")}</li>
          <li>新規: {job.createdCount.toLocaleString("ja-JP")}</li>
          <li>更新: {job.updatedCount.toLocaleString("ja-JP")}</li>
          <li>変更なし: {job.unchangedCount.toLocaleString("ja-JP")}</li>
          <li>スキップ: {job.skippedCount.toLocaleString("ja-JP")}</li>
          <li>エラー: {job.errorCount.toLocaleString("ja-JP")}</li>
          <li>
            offset: {job.currentOffset} → {job.nextOffset}
          </li>
          <li>推定JSON保存: {job.estimatedJsonSaves ?? 0}</li>
          <li>rawシャード: {(job.rawShardsTouched ?? []).length}</li>
          <li className="sm:col-span-2">
            変更フィールド: {(job.changedFields ?? []).join(", ") || "-"}
          </li>
        </ul>
      ) : null}

      {job?.lastError ? (
        <p className="mt-2 text-xs text-red-700">{job.lastError}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onStart({ dryRun: true })}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
        >
          dry-run開始
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onStart({ dryRun: false })}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {mode === "light" ? "軽量同期を開始" : "完全同期を開始"}
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onResume}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs disabled:opacity-50"
        >
          再開
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onPause}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs disabled:opacity-50"
        >
          一時停止
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs disabled:opacity-50"
        >
          停止
        </button>
      </div>
    </section>
  );
}

function lightDisabledReason(overview: SyncOverview | null): string | null {
  if (!overview) return null;
  const lines: string[] = [];
  if (!overview.lightEnabled) {
    lines.push("軽量同期は現在無効です。");
    lines.push(
      "ローカル環境の .env.local に DOUJIN_LIGHT_SYNC_ENABLED=true を設定してください。",
    );
  }
  if (!overview.writeAllowed) {
    lines.push(
      "ローカル書き込みを有効にするには、DOUJIN_LOCAL_WRITE_ENABLED=true が必要です。",
    );
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function fullDisabledReason(overview: SyncOverview | null): string | null {
  if (!overview) return null;
  const lines: string[] = [];
  if (!overview.fullEnabled) {
    lines.push("完全同期は現在無効です。");
    lines.push(
      "ローカル環境の .env.local に DOUJIN_FULL_SYNC_ENABLED=true を設定してください。",
    );
  }
  if (!overview.writeAllowed) {
    lines.push(
      "ローカル書き込みを有効にするには、DOUJIN_LOCAL_WRITE_ENABLED=true が必要です。",
    );
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

export function DoujinSyncClient() {
  const [overview, setOverview] = useState<SyncOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/doujin/sync");
    if (!response.ok) return;
    const json = (await response.json()) as SyncOverview;
    setOverview(json);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const jobId = overview?.runningJobId;
    if (!jobId || !overview?.writeAllowed) return;
    let cancelled = false;

    async function tickLoop() {
      let currentJobId = jobId;
      while (!cancelled && currentJobId) {
        try {
          const response = await fetch("/api/admin/doujin/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "tick", jobId: currentJobId }),
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
      const response = await fetch("/api/admin/doujin/sync", {
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

  const writeAllowed = overview?.writeAllowed ?? false;
  const lightEnabled = overview?.lightEnabled === true;
  const fullEnabled = overview?.fullEnabled === true;

  return (
    <div className="space-y-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div>
        <h2 className="text-lg font-bold">FANZA同期（軽量 / 完全）</h2>
        <p className="mt-1 text-sm text-muted">
          既存カタログの差分更新です。新規大量導入は別の取得・importを使います。
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
        <p className="font-medium text-foreground">同期可能条件</p>
        <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
          <li>軽量同期：{lightEnabled ? "有効" : "無効"}</li>
          <li>完全同期：{fullEnabled ? "有効" : "無効"}</li>
          <li>ローカル書き込み：{writeAllowed ? "有効" : "無効"}</li>
          <li>Vercel環境：{overview?.isVercel ? "はい" : "いいえ"}</li>
        </ul>
      </div>

      {!writeAllowed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            本番環境では作品データの直接更新はできません。
          </p>
          <p className="mt-1">
            ローカル環境で同期を実行し、JSONをGitへコミット・pushしてください。
          </p>
          <p className="mt-1 text-xs">
            ローカル書き込みを有効にするには、DOUJIN_LOCAL_WRITE_ENABLED=true
            が必要です。
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs">
            <li>ローカル環境で同期を実行</li>
            <li>検証コマンドを実行</li>
            <li>JSONとrawシャードの変更を確認</li>
            <li>Gitへコミット</li>
            <li>GitHubへpush</li>
            <li>Vercelのデプロイ完了後に公開ページを確認</li>
          </ol>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <JobPanel
          title="軽量同期"
          description="価格、割引、評価、レビュー、ランキングのみを更新します。日常更新向けの低負荷処理です。"
          disabledReason={lightDisabledReason(overview)}
          job={overview?.light ?? null}
          mode="light"
          disabled={!writeAllowed || !lightEnabled}
          busy={busy}
          onStart={({ dryRun }) =>
            void post({
              action: "start",
              mode: "light",
              dryRun,
              site: "FANZA",
              service: "doujin",
              floor: "digital_doujin",
            })
          }
          onResume={() =>
            void post({ action: "resume", mode: "light" })
          }
          onPause={() => void post({ action: "pause", jobId: overview?.light?.id })}
          onCancel={() =>
            void post({ action: "cancel", jobId: overview?.light?.id })
          }
        />
        <JobPanel
          title="完全同期"
          description="説明文、画像、サンプル画像、作者、シリーズ、ジャンルなどを含む全情報を更新します。高負荷のため、週1回または必要時のみ実行してください。"
          warning="完全同期は処理負荷が高いため、通常は軽量同期を使用してください。"
          disabledReason={fullDisabledReason(overview)}
          job={overview?.full ?? null}
          mode="full"
          disabled={!writeAllowed || !fullEnabled}
          busy={busy}
          onStart={({ dryRun }) =>
            void post({
              action: "start",
              mode: "full",
              dryRun,
              site: "FANZA",
              service: "doujin",
              floor: "digital_doujin",
            })
          }
          onResume={() => void post({ action: "resume", mode: "full" })}
          onPause={() => void post({ action: "pause", jobId: overview?.full?.id })}
          onCancel={() =>
            void post({ action: "cancel", jobId: overview?.full?.id })
          }
        />
      </div>
    </div>
  );
}
