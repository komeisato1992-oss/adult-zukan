"use client";

import {
  formatDateTime,
  formatDuration,
} from "@/components/admin/works-cms/format";
import type {
  FanzaTvCheckJobView,
  FanzaTvCheckStatsView,
  WorksCmsOverview,
} from "@/components/admin/works-cms/types";

type FanzaTvTabProps = {
  overview: WorksCmsOverview | null;
  job: FanzaTvCheckJobView | null;
  stats: FanzaTvCheckStatsView | null;
  profileReady: boolean;
  profileMessage: string | null;
  /** false = Vercel等。Playwright起動不可 */
  canRunPlaywright: boolean;
  busy: boolean;
  onStart: (
    mode: "unchecked_only" | "full_recheck" | "limit",
    limit?: 100 | 500 | 1000 | "all",
  ) => void;
  onStop: () => void;
  onResume: () => void;
};

function displayCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

export function WorksCmsFanzaTvTab({
  overview,
  job,
  stats,
  profileReady,
  profileMessage,
  canRunPlaywright,
  busy,
  onStart,
  onStop,
  onResume,
}: FanzaTvTabProps) {
  const tv = overview?.fanzaTv;
  const totalCount = stats?.totalCount ?? overview?.totalCount ?? 0;
  const availableCount = stats?.availableCount ?? tv?.activeCount ?? 0;
  const unavailableCount =
    stats?.unavailableCount ?? tv?.notAvailableCount ?? 0;
  const uncheckedCount = stats?.uncheckedCount ?? tv?.uncheckedCount ?? 0;
  const lastCheckedAt = stats?.lastCheckedAt ?? tv?.lastCheckedAt ?? null;
  const schemaReady = stats?.schemaReady !== false;

  const running =
    job?.status === "running" || job?.status === "pending";
  const canResume =
    canRunPlaywright &&
    (job?.status === "stopped" || job?.status === "failed") &&
    (job.pendingCount ?? 0) > 0;
  const progress = job?.progressPercent ?? 0;
  const canStart =
    canRunPlaywright && !busy && !running && schemaReady && profileReady;

  const cards = [
    { label: "対象作品", value: displayCount(totalCount) },
    { label: "見放題件数", value: displayCount(availableCount) },
    { label: "対象外件数", value: displayCount(unavailableCount) },
    { label: "未確認件数", value: displayCount(uncheckedCount) },
    {
      label: "最終更新日時",
      value: lastCheckedAt ? formatDateTime(lastCheckedAt) : "未判定",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-950">
        <p className="font-bold">FANZA TV見放題管理</p>
        <p className="mt-1 leading-relaxed">
          Mac上のPlaywrightで見放題判定し、結果のみSupabaseのworksへ保存します。JSON更新・Git・Vercelデプロイは行いません。公開ページの表示変更は次段階です。
        </p>
      </div>

      {!schemaReady ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-950">
          works に fanza_tv_* 列がありません。判定は実行できません。Supabase SQL
          Editor で
          <code className="mx-1">
            supabase/migrations/20260716_004_works_fanza_tv.sql
          </code>
          を適用してください。
        </div>
      ) : null}

      {!canRunPlaywright ? (
        <div className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          見放題判定はMac上で実行します。本番管理画面では結果と進捗のみ確認できます。
        </div>
      ) : !profileReady ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {profileMessage ||
            "Playwrightプロファイルが未設定です。先に npm run fanza-tv:save-profile を実行してください。"}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-white px-2.5 py-2"
          >
            <p className="text-[10px] text-muted">{c.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums leading-tight">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* 前回処理結果（ジョブがあれば詳細、なければDB集計のみ） */}
      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <p className="text-sm font-bold">前回処理結果</p>
        {job ? (
          <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 text-xs">
            <div>
              <dt className="text-muted">状態</dt>
              <dd className="font-bold">{job.status}</dd>
            </div>
            <div>
              <dt className="text-muted">成功件数</dt>
              <dd className="font-bold tabular-nums text-emerald-800">
                {job.successCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">失敗件数</dt>
              <dd className="font-bold tabular-nums text-red-700">
                {job.failedCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">実行時間</dt>
              <dd className="font-bold">{formatDuration(job.elapsedMs)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted">メッセージ</dt>
              <dd className="font-medium">{job.message || "—"}</dd>
            </div>
            {job.lastError ? (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-muted">エラー</dt>
                <dd className="font-medium text-red-700">{job.lastError}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-xs text-muted">
            詳細ジョブ履歴はMac実行時に表示されます。現在のDB集計: 見放題{" "}
            {displayCount(availableCount)} / 対象外{" "}
            {displayCount(unavailableCount)} / 未確認{" "}
            {displayCount(uncheckedCount)}
          </p>
        )}
      </div>

      {canRunPlaywright ? (
        <div className="rounded-xl border border-border bg-white p-3 space-y-2">
          <p className="text-sm font-bold">実行メニュー（Macローカル）</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canStart}
              onClick={() => onStart("unchecked_only")}
              className="min-h-[40px] rounded-lg bg-sky-600 text-sm font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
            >
              ① 未確認のみ判定
            </button>
            <button
              type="button"
              disabled={!canStart}
              onClick={() => onStart("full_recheck")}
              className="min-h-[40px] rounded-lg border border-sky-600 text-sm font-bold text-sky-800 disabled:border-zinc-300 disabled:text-zinc-500"
            >
              ② 全件再判定
            </button>
          </div>
          <p className="text-xs font-semibold text-muted">③ 指定件数のみ</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([100, 500, 1000, "all"] as const).map((limit) => (
              <button
                key={String(limit)}
                type="button"
                disabled={!canStart}
                onClick={() => onStart("limit", limit)}
                className="min-h-[40px] rounded-lg border border-border text-sm font-semibold disabled:text-zinc-500"
              >
                {limit === "all" ? "全件" : `${limit}件`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-3 space-y-2">
          <p className="text-sm font-bold">実行メニュー</p>
          <p className="text-xs text-muted">
            本番（Vercel）では判定を開始できません。Macのターミナルで実行してください。
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 opacity-60">
            <button
              type="button"
              disabled
              className="min-h-[40px] rounded-lg bg-zinc-300 text-sm font-bold text-zinc-600"
            >
              ① 未確認のみ判定
            </button>
            <button
              type="button"
              disabled
              className="min-h-[40px] rounded-lg border border-zinc-300 text-sm font-bold text-zinc-500"
            >
              ② 全件再判定
            </button>
          </div>
          <p className="text-xs font-semibold text-muted">③ 指定件数のみ</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([100, 500, 1000, "all"] as const).map((limit) => (
              <button
                key={String(limit)}
                type="button"
                disabled
                className="min-h-[40px] rounded-lg border border-zinc-300 text-sm font-semibold text-zinc-500"
              >
                {limit === "all" ? "全件" : `${limit}件`}
              </button>
            ))}
          </div>
        </div>
      )}

      {job && canRunPlaywright ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 space-y-2 text-xs text-sky-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              実行状況: {job.status}
              {job.currentCid ? ` · ${job.currentCid}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {running ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onStop}
                  className="min-h-[36px] rounded-lg border border-red-400 bg-white px-3 font-semibold text-red-700 disabled:opacity-50"
                >
                  途中停止
                </button>
              ) : null}
              {canResume ? (
                <button
                  type="button"
                  disabled={busy || !schemaReady || !profileReady}
                  onClick={onResume}
                  className="min-h-[36px] rounded-lg border border-emerald-500 bg-white px-3 font-semibold text-emerald-800 disabled:opacity-50"
                >
                  途中再開
                </button>
              ) : null}
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-sky-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>

          <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <div>
              <dt className="text-muted">現在件数</dt>
              <dd className="font-bold tabular-nums">
                {job.processedCount.toLocaleString()} /{" "}
                {job.targetCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">成功</dt>
              <dd className="font-bold tabular-nums text-emerald-800">
                {job.successCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">失敗</dt>
              <dd className="font-bold tabular-nums text-red-700">
                {job.failedCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted">経過時間</dt>
              <dd className="font-bold">{formatDuration(job.elapsedMs)}</dd>
            </div>
            <div>
              <dt className="text-muted">予想残り時間</dt>
              <dd className="font-bold">
                {running ? formatDuration(job.estimatedRemainingMs) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">見放題 / 対象外</dt>
              <dd className="font-bold tabular-nums">
                {job.availableCount.toLocaleString()} /{" "}
                {job.unavailableCount.toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <p className="text-sm font-bold">Mac実行コマンド</p>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 px-3 py-2 text-[11px] text-zinc-100">
          {`# 初回のみ: 年齢確認・ログイン状態を保存
npm run fanza-tv:save-profile

# 指定件数（--limit が必ず反映されます）
npm run fanza-tv:check -- --limit=100
npm run fanza-tv:check -- --limit=500
npm run fanza-tv:check -- --limit=1000
npm run fanza-tv:check -- --limit=5000
npm run fanza-tv:check -- --limit=all

# 件数だけ確認（判定しない）
npm run fanza-tv:check -- --limit=1000 --fetch-only`}
        </pre>
      </div>
    </section>
  );
}
