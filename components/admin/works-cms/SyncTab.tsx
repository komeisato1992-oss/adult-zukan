"use client";

import { useMemo, useState } from "react";
import {
  estimateSyncEta,
  formatDateTime,
} from "@/components/admin/works-cms/format";
import {
  SYNC_CARDS,
  type LiveInitJob,
  type SyncJob,
  type SyncTargetScope,
  type WorksCmsOverview,
} from "@/components/admin/works-cms/types";
import { getAdultSyncModeLabel, type AdultSyncMode } from "@/lib/dmm/sync-mode";

type SyncTabProps = {
  overview: WorksCmsOverview | null;
  syncJob: SyncJob | null;
  syncTargetCount: number;
  canStartLightSync: boolean;
  disableReasons: string[];
  lastSuccessByMode: Partial<Record<AdultSyncMode, string | null>>;
  liveInitJob: LiveInitJob | null;
  busy: boolean;
  onStartSync: (mode: AdultSyncMode) => void;
  onResumeSync: () => void;
  onStartLiveInit: () => void;
  onStopLiveInit: () => void;
  onResumeLiveInit: () => void;
  onUnpublishNoImage: () => void;
  unpublishNoImageResult?: string | null;
};

const TARGET_OPTIONS: Array<{ id: SyncTargetScope; label: string }> = [
  { id: "all", label: "全作品" },
  { id: "unchecked", label: "未確認のみ" },
  { id: "selected", label: "選択作品" },
  { id: "maker", label: "メーカー別" },
  { id: "actress", label: "女優別" },
  { id: "series", label: "シリーズ別" },
  { id: "genre", label: "ジャンル別" },
  { id: "release_range", label: "発売日範囲" },
  { id: "cid_range", label: "CID範囲" },
];

export function WorksCmsSyncTab({
  overview,
  syncJob,
  syncTargetCount,
  canStartLightSync,
  disableReasons,
  lastSuccessByMode,
  liveInitJob,
  busy,
  onStartSync,
  onResumeSync,
  onStartLiveInit,
  onStopLiveInit,
  onResumeLiveInit,
  onUnpublishNoImage,
  unpublishNoImageResult,
}: SyncTabProps) {
  const [targetScope, setTargetScope] = useState<SyncTargetScope>("all");
  const [filterValue, setFilterValue] = useState("");

  const scopeBlockReason = useMemo(() => {
    if (targetScope === "all") return null;
    return "対象絞り込み（全作品以外）は次回実装予定です。現在は全作品のみ実行できます。";
  }, [targetScope]);

  const baseReasons = disableReasons.length > 0 ? disableReasons : [];
  const blockedReasons = [
    ...baseReasons,
    ...(scopeBlockReason ? [scopeBlockReason] : []),
  ];
  const canRun = canStartLightSync && !scopeBlockReason && !busy;
  const initComplete = overview?.liveInitComplete === true;
  const initRunning =
    liveInitJob?.status === "running" ||
    liveInitJob?.status === "pending" ||
    liveInitJob?.status === "waiting";

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">
        価格・セール・評価・順位・販売状況をSupabaseへ直接更新します。デプロイは発生しません。
      </p>

      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <p className="text-sm font-bold">更新対象</p>
        <div className="flex flex-wrap gap-1.5">
          {TARGET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTargetScope(opt.id)}
              className={`min-h-[34px] rounded-lg px-2.5 text-xs ${
                targetScope === opt.id
                  ? "bg-sky-600 font-semibold text-white"
                  : "border border-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {targetScope !== "all" && targetScope !== "unchecked" && targetScope !== "selected" ? (
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="絞り込み条件（将来用）"
            className="min-h-[36px] w-full rounded-lg border border-border px-2 text-sm"
            disabled
          />
        ) : null}
        <p className="text-xs text-muted">
          対象件数: {syncTargetCount.toLocaleString()}件
        </p>
        {blockedReasons.length > 0 ? (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 space-y-0.5">
            {blockedReasons.map((r) => (
              <li key={r}>・{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-emerald-800">実行可能な状態です</p>
        )}
      </div>

      {syncJob ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          <p className="font-bold">
            実行中ジョブ: {getAdultSyncModeLabel((syncJob.mode as AdultSyncMode) || "light")} /{" "}
            {syncJob.status}
          </p>
          <p>
            {syncJob.processedCount}/{syncJob.targetCount} · 更新{" "}
            {syncJob.updatedCount} · 失敗 {syncJob.errorCount}
          </p>
          <p className="truncate">{syncJob.message}</p>
          {(syncJob.status === "partial_failed" ||
            syncJob.status === "failed" ||
            syncJob.cursor) && (
            <button
              type="button"
              disabled={busy}
              onClick={onResumeSync}
              className="mt-2 min-h-[36px] rounded-lg border border-emerald-500 bg-white px-3 font-semibold text-emerald-800 disabled:opacity-50"
            >
              途中再開
            </button>
          )}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {SYNC_CARDS.map((card) => {
          const last = lastSuccessByMode[card.mode] ?? null;
          return (
            <article
              key={card.mode}
              className="rounded-xl border border-border bg-white p-3 space-y-2"
            >
              <div>
                <h3 className="text-sm font-bold">{card.title}</h3>
                <p className="text-xs text-muted">{card.description}</p>
              </div>
              <dl className="grid grid-cols-2 gap-1 text-[11px]">
                <div>
                  <dt className="text-muted">対象件数</dt>
                  <dd className="font-semibold tabular-nums">
                    {syncTargetCount.toLocaleString()}件
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">予想所要</dt>
                  <dd className="font-semibold">
                    {estimateSyncEta(syncTargetCount, card.etaPerThousandSec)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">最終成功</dt>
                  <dd className="font-semibold">{formatDateTime(last)}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={!canRun}
                onClick={() => onStartSync(card.mode)}
                className="min-h-[40px] w-full rounded-lg bg-sky-600 text-sm font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
              >
                実行
              </button>
              {!canRun && blockedReasons[0] ? (
                <p className="text-[11px] text-amber-800">
                  実行不可: {blockedReasons[0]}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <details className="rounded-xl border border-zinc-300 bg-zinc-50 p-3">
        <summary className="cursor-pointer text-sm font-bold text-zinc-800">
          初期設定・メンテナンス
        </summary>
        <div className="mt-2 space-y-2 text-xs">
          <p className="text-muted">
            変動情報（work_live_status）の初期化は通常運用とは分離しています。完了済みの場合は操作不要です。
          </p>
          <div className="rounded-lg border border-border bg-white px-2.5 py-2">
            <p className="font-bold">
              変動情報初期化{" "}
              {overview
                ? `${overview.liveStatusCount.toLocaleString()} / ${overview.worksMasterCount.toLocaleString()}件`
                : "—"}
            </p>
            {initComplete ? (
              <p className="mt-1 text-emerald-800 font-semibold">
                完了済み（通常は操作不要）
              </p>
            ) : (
              <p className="mt-1 text-amber-900">
                未初期化 {overview?.missingLiveCount.toLocaleString() ?? "—"}件
                （初期化率 {overview?.initRatePercent ?? 0}%）
              </p>
            )}
            {liveInitJob ? (
              <p className="mt-1 text-muted">
                状態 {liveInitJob.status} · 挿入 {liveInitJob.insertedCount} · 失敗{" "}
                {liveInitJob.failedCount} · 残り {liveInitJob.remainingCount}
              </p>
            ) : null}
            {!initComplete ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy || initRunning}
                  onClick={onStartLiveInit}
                  className="min-h-[36px] rounded-lg bg-sky-600 px-3 font-semibold text-white disabled:opacity-50"
                >
                  変動情報を初期化
                </button>
                <button
                  type="button"
                  disabled={busy || !initRunning}
                  onClick={onStopLiveInit}
                  className="min-h-[36px] rounded-lg border border-red-300 px-3 font-semibold text-red-700 disabled:opacity-50"
                >
                  停止
                </button>
                <button
                  type="button"
                  disabled={busy || initComplete}
                  onClick={onResumeLiveInit}
                  className="min-h-[36px] rounded-lg border px-3 font-semibold disabled:opacity-50"
                >
                  再開
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-amber-200 bg-white px-2.5 py-2">
            <p className="font-bold">画像なし作品を非公開化</p>
            <p className="mt-1 text-muted">
              isMissingAdultImage で無効な作品を published=false /
              理由=no_package_image にします。Git・JSON・デプロイは発生しません。画像が後から取得できれば再公開候補になります。
            </p>
            <p className="mt-1">
              現在の画像なし:{" "}
              <span className="font-semibold tabular-nums">
                {overview?.noPackageImageCount.toLocaleString() ?? "—"}件
              </span>
              {(overview?.publishedNoImageCount ?? 0) > 0 ? (
                <span className="text-amber-800">
                  {" "}
                  （うち公開中 {overview?.publishedNoImageCount}件）
                </span>
              ) : null}
            </p>
            <button
              type="button"
              disabled={busy || (overview?.noPackageImageCount ?? 0) === 0}
              onClick={onUnpublishNoImage}
              className="mt-2 min-h-[36px] w-full rounded-lg bg-amber-600 px-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              画像なし作品を非公開化
            </button>
            {unpublishNoImageResult ? (
              <p className="mt-1 text-emerald-800">{unpublishNoImageResult}</p>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}
