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
  type SyncProgressState,
  type SyncTargetScope,
  type WorksCmsOverview,
} from "@/components/admin/works-cms/types";
import { getAdultSyncModeLabel, type AdultSyncMode } from "@/lib/dmm/sync-mode";

type SyncTabProps = {
  overview: WorksCmsOverview | null;
  syncJob: SyncJob | null;
  syncTargetCount: number;
  uncheckedCount: number;
  syncProgress: SyncProgressState | null;
  canStartLightSync: boolean;
  disableReasons: string[];
  lastSuccessByMode: Partial<Record<AdultSyncMode, string | null>>;
  liveInitJob: LiveInitJob | null;
  busy: boolean;
  onStartSync: (input: {
    mode: AdultSyncMode;
    limit: number;
    targetScope: SyncTargetScope;
    startOffset: number;
  }) => void;
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

const PRESET_LIMITS = [100, 300, 500, 1000] as const;
const DEFAULT_LIMIT = 300;

export function WorksCmsSyncTab({
  overview,
  syncJob,
  syncTargetCount,
  uncheckedCount,
  syncProgress,
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
  const [runLimit, setRunLimit] = useState(DEFAULT_LIMIT);
  const [customLimitDraft, setCustomLimitDraft] = useState("");
  const [usingCustom, setUsingCustom] = useState(false);
  /** null = サーバー保存の nextOffset を使う */
  const [offsetOverride, setOffsetOverride] = useState<number | null>(null);

  const scopeBlockReason = useMemo(() => {
    if (targetScope === "all" || targetScope === "unchecked") return null;
    return "対象絞り込み（全作品・未確認以外）は次回実装予定です。";
  }, [targetScope]);

  const progressScope: SyncTargetScope =
    targetScope === "unchecked" ? "unchecked" : "all";
  const savedProgress = syncProgress?.scopes?.[progressScope] ?? null;
  const universeTotal =
    targetScope === "unchecked" ? uncheckedCount : syncTargetCount;
  const startOffset = Math.max(
    0,
    offsetOverride ?? savedProgress?.nextOffset ?? 0,
  );
  const effectiveStart =
    universeTotal > 0 ? Math.min(startOffset, Math.max(0, universeTotal - 1)) : 0;
  const thisRunCount = Math.min(
    Math.max(1, runLimit),
    Math.max(0, universeTotal - effectiveStart),
  );
  const thisRunEnd =
    thisRunCount > 0 ? effectiveStart + thisRunCount - 1 : effectiveStart;
  const nextStartAfterRun =
    universeTotal > 0 && effectiveStart + thisRunCount >= universeTotal
      ? 0
      : effectiveStart + thisRunCount;

  const baseReasons = disableReasons.length > 0 ? disableReasons : [];
  const blockedReasons = [
    ...baseReasons,
    ...(scopeBlockReason ? [scopeBlockReason] : []),
    ...(thisRunCount <= 0 ? ["今回の処理対象が0件です"] : []),
  ];
  const canRun =
    canStartLightSync && !scopeBlockReason && !busy && thisRunCount > 0;
  const initComplete = overview?.liveInitComplete === true;
  const initRunning =
    liveInitJob?.status === "running" ||
    liveInitJob?.status === "pending" ||
    liveInitJob?.status === "waiting";
  const showLargeWarning = runLimit >= 500;

  const applyPreset = (n: number) => {
    setUsingCustom(false);
    setCustomLimitDraft("");
    setRunLimit(n);
  };

  const applyCustom = () => {
    const n = Math.floor(Number(customLimitDraft));
    if (!Number.isFinite(n) || n <= 0) return;
    setUsingCustom(true);
    setRunLimit(Math.min(5000, Math.max(1, n)));
  };

  const startPayload = (mode: AdultSyncMode) => ({
    mode,
    limit: runLimit,
    targetScope: progressScope,
    startOffset: effectiveStart,
  });

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">
        価格・セール・評価・順位・販売状況をSupabaseへ直接更新します。デプロイは発生しません。
      </p>

      <div className="rounded-xl border border-border bg-white p-3 space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-bold">更新対象</p>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTargetScope(opt.id);
                  setOffsetOverride(null);
                }}
                className={`min-h-[40px] rounded-lg px-3 text-xs ${
                  targetScope === opt.id
                    ? "bg-sky-600 font-semibold text-white"
                    : "border border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {targetScope !== "all" &&
          targetScope !== "unchecked" &&
          targetScope !== "selected" ? (
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="絞り込み条件（将来用）"
              className="min-h-[36px] w-full rounded-lg border border-border px-2 text-sm"
              disabled
            />
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-bold">処理件数</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PRESET_LIMITS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applyPreset(n)}
                className={`min-h-[44px] rounded-lg text-sm font-semibold ${
                  !usingCustom && runLimit === n
                    ? "bg-sky-600 text-white"
                    : "border border-border"
                }`}
              >
                {n}件
              </button>
            ))}
            <div className="col-span-2 sm:col-span-3 flex gap-1.5">
              <input
                type="number"
                min={1}
                max={5000}
                inputMode="numeric"
                value={customLimitDraft}
                onChange={(e) => setCustomLimitDraft(e.target.value)}
                placeholder="件数を入力"
                className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${
                  usingCustom ? "border-sky-500 ring-1 ring-sky-300" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={applyCustom}
                className="min-h-[44px] shrink-0 rounded-lg border border-border px-3 text-sm font-semibold"
              >
                適用
              </button>
            </div>
          </div>
          {showLargeWarning ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
              大量処理は時間と通信量が増えます。通常は300件以下を推奨します。
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-zinc-50 px-2.5 py-2 text-xs space-y-1">
          <p>
            対象総数：
            <span className="font-bold tabular-nums">
              {universeTotal.toLocaleString()}
            </span>
            件
            {targetScope === "unchecked" ? "（image_status未確認）" : null}
          </p>
          <p>
            今回の処理：
            <span className="font-bold tabular-nums">
              {thisRunCount.toLocaleString()}
            </span>
            件（{effectiveStart}〜{thisRunEnd}）
          </p>
          <p>
            次回開始：
            <span className="font-bold tabular-nums">{nextStartAfterRun}</span>
          </p>
          {savedProgress?.lastRunEnd != null &&
          savedProgress.lastRunStart != null ? (
            <p className="text-muted">
              前回処理：{savedProgress.lastRunStart}〜{savedProgress.lastRunEnd}
              {savedProgress.lastLimit != null
                ? `（指定${savedProgress.lastLimit}件）`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <label className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-2 text-xs">
            開始offset
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={effectiveStart}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                setOffsetOverride(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
              className="w-20 min-h-[32px] rounded border border-border px-1.5 tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setOffsetOverride(Math.max(0, effectiveStart - runLimit))
            }
            className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50"
          >
            前へ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOffsetOverride(effectiveStart + runLimit)}
            className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50"
          >
            次へ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOffsetOverride(0)}
            className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50"
          >
            0に戻す
          </button>
          <button
            type="button"
            disabled={!canRun}
            onClick={() => {
              const mode =
                (syncJob?.mode as AdultSyncMode | undefined) ||
                (savedProgress?.lastMode as AdultSyncMode | undefined) ||
                "light";
              const safeMode =
                mode === "price" ||
                mode === "review" ||
                mode === "rank" ||
                mode === "date" ||
                mode === "availability" ||
                mode === "light"
                  ? mode
                  : "light";
              onStartSync({
                mode: safeMode,
                limit: runLimit,
                targetScope: progressScope,
                startOffset: savedProgress?.nextOffset ?? 0,
              });
              setOffsetOverride(null);
            }}
            className="min-h-[40px] rounded-lg border border-emerald-500 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 disabled:opacity-50"
          >
            次の{runLimit}件を実行
          </button>
        </div>
        <p className="text-[11px] text-muted">
          「次の{runLimit}件を実行」は保存済みの次回開始位置から続けます。各カードの実行ボタンは上の開始offsetを使います。
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
            syncJob.cursor != null) && (
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
                  <dt className="text-muted">対象総数</dt>
                  <dd className="font-semibold tabular-nums">
                    {universeTotal.toLocaleString()}件
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">今回の処理</dt>
                  <dd className="font-semibold tabular-nums">
                    {thisRunCount.toLocaleString()}件
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">予想所要</dt>
                  <dd className="font-semibold">
                    {estimateSyncEta(thisRunCount, card.etaPerThousandSec)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">最終成功</dt>
                  <dd className="font-semibold">{formatDateTime(last)}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={!canRun}
                onClick={() => {
                  setOffsetOverride(null);
                  onStartSync(startPayload(card.mode));
                }}
                className="min-h-[44px] w-full rounded-lg bg-sky-600 text-sm font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
              >
                {thisRunCount}件を実行
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
              image_status（追加・更新時の画像取得判定）で無効な作品を published=false /
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
