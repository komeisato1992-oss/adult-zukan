import "server-only";

import {
  FANZA_SYNC_BATCH_INTERVAL_MS,
  FANZA_SYNC_COMMIT_MAX_RETRIES,
  FANZA_SYNC_DEFAULT_CONCURRENCY,
  FANZA_SYNC_HISTORY_LIMIT,
  FANZA_SYNC_JOB_STALE_MS,
  getAdultLightSyncTargetLimit,
} from "@/lib/admin/fanza-sync-constants";
import {
  createFanzaSyncJob,
  isFanzaSyncJobRunning,
  isFanzaSyncJobStale,
  toHistoryEntry,
} from "@/lib/admin/fanza-sync-job";
import {
  advanceFanzaSyncProgress,
  advanceWorksMasterUpdatedAtWatermark,
  getWorksMasterUpdatedAtWatermark,
  isFanzaSyncTargetScope,
  loadFanzaSyncProgress,
  type FanzaSyncTargetScope,
} from "@/lib/admin/fanza-sync-progress";
import {
  finalizeSnapshotWithHistory,
  loadFanzaSyncSnapshot,
  persistFanzaSyncSnapshotLocally,
  serializeFanzaSyncJobFile,
} from "@/lib/admin/github-fanza-sync-storage";
import {
  selectFanzaSyncBatch,
  sortWorksForFanzaSync,
  sortWorksForFanzaSyncStable,
} from "@/lib/admin/fanza-sync-priority";
import {
  commitCatalogBundleToGitHub,
  commitGitHubFilesBundle,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
  type CatalogSnapshotHandle,
} from "@/lib/admin/github-catalog";
import { commitChangedCatalogShardsToGitHub } from "@/lib/admin/github-catalog-shards";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { isDmmConfigured } from "@/lib/dmm/client";
import { filterPublicCatalogWorks } from "@/lib/dmm/catalog-visibility";
import { getCatalogManifest } from "@/lib/dmm/catalog-shards";
import { normalizeCatalogContentId, readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { syncFanzaProduct } from "@/lib/dmm/fanza-sync-product";
import {
  IndexRebuildError,
  rebuildAllIndexes,
  serializeCatalogIndexes,
} from "@/lib/dmm/index-builders";
import {
  ADULT_SYNC_MODE_FULL,
  ADULT_SYNC_MODE_LIGHT,
  isAdultPartialSyncMode,
  isAdultSyncMode,
  type AdultSyncMode,
} from "@/lib/dmm/sync-mode";
import {
  resolveFullSyncEnabled,
  resolveLightSyncEnabled,
} from "@/lib/admin/admin-ops-settings";
import { upsertLiveStatusFromWorks } from "@/lib/dmm/work-live-status";
import type { FanzaSyncJob, FanzaSyncJobSnapshot, FanzaSyncTrigger } from "@/lib/admin/fanza-sync-types";
import type { DmmItem } from "@/lib/dmm/types";

export class FanzaSyncError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FanzaSyncError";
    this.status = status;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
  return results;
}

function minimalSyncStub(cid: string): DmmItem {
  return {
    content_id: cid,
    product_id: cid,
    title: cid,
    URL: "",
    affiliateURL: "",
  };
}

type SyncUniverseCache = {
  jobId: string;
  scope: FanzaSyncTargetScope;
  mode: AdultSyncMode;
  items: DmmItem[];
  expiresAt: number;
};

type SyncUniverseCacheHolder = typeof globalThis & {
  __fanzaSyncUniverseCache?: SyncUniverseCache | null;
};

function getSyncUniverseCache(): SyncUniverseCache | null {
  return (globalThis as SyncUniverseCacheHolder).__fanzaSyncUniverseCache ?? null;
}

function setSyncUniverseCache(cache: SyncUniverseCache | null): void {
  (globalThis as SyncUniverseCacheHolder).__fanzaSyncUniverseCache = cache;
}

function buildCatalogByCid(items: DmmItem[]): Map<string, DmmItem> {
  const byCid = new Map<string, DmmItem>();
  for (const item of items) {
    const cid = normalizeCatalogContentId(item.content_id);
    if (!cid) continue;
    byCid.set(cid, { ...item, content_id: cid });
  }
  return byCid;
}

/**
 * 部分同期用カタログ構築（Egress 最小化）。
 * - 全件 select("*") は行わない
 * - CID 一覧（cid 列のみ）+ ローカル JSON
 * - updated_at ウォーターマーク以降の差分のみ狭い列で取得して重ねる
 */
async function loadPartialSyncCatalogItems(options?: {
  applyEnvLimit?: boolean;
}): Promise<DmmItem[]> {
  const {
    getWorksMasterContentIdSet,
    fetchWorkMastersUpdatedSince,
    mergeSyncMasterRowIntoDmmItem,
  } = await import("@/lib/dmm/works-master");

  const json = readCatalogSnapshot();
  const byCid = buildCatalogByCid(json);

  // updated_at 差分（狭い列）。初回ウォーターマーク未設定時は全件取得せず、
  // ベースラインを「現在時刻」に置いて以降の差分のみ取る。
  const watermark = getWorksMasterUpdatedAtWatermark();
  if (!watermark) {
    const bootstrapped = advanceWorksMasterUpdatedAtWatermark(
      new Date().toISOString(),
    );
    console.log("[fanza-sync] works-master watermark bootstrapped", {
      watermark: bootstrapped,
    });
  } else {
    let maxUpdatedAt: string | null = watermark;
    try {
      const deltaRows = await fetchWorkMastersUpdatedSince(watermark, {
        publishedOnly: false,
        maxRows: 5_000,
      });
      for (const row of deltaRows) {
        const existing = byCid.get(row.cid);
        byCid.set(row.cid, mergeSyncMasterRowIntoDmmItem(existing, row));
        if (
          !maxUpdatedAt ||
          Date.parse(row.updated_at) > Date.parse(maxUpdatedAt)
        ) {
          maxUpdatedAt = row.updated_at;
        }
      }
      if (deltaRows.length > 0) {
        advanceWorksMasterUpdatedAtWatermark(maxUpdatedAt);
        console.log("[fanza-sync] works-master delta applied", {
          count: deltaRows.length,
          watermarkFrom: watermark,
          watermarkTo: maxUpdatedAt,
        });
      }
    } catch (error) {
      console.warn("[fanza-sync] works-master delta fetch skipped", error);
    }
  }

  // 非公開含む同期対象宇宙: CID のみ（全列取得しない）
  const allCids = [...(await getWorksMasterContentIdSet())].sort((a, b) =>
    a.localeCompare(b),
  );
  let items = allCids.map((cid) => byCid.get(cid) ?? minimalSyncStub(cid));

  if (options?.applyEnvLimit) {
    const limit = getAdultLightSyncTargetLimit();
    if (limit > 0) {
      items = items.slice(0, limit);
    }
  }

  return items;
}

async function loadCatalogForSync(
  mode?: AdultSyncMode,
  options?: { applyEnvLimit?: boolean },
): Promise<CatalogSnapshotHandle> {
  // 部分同期: 全件マスター select を廃止し、CID + JSON + updated_at 差分のみ
  if (mode && isAdultPartialSyncMode(mode)) {
    try {
      const items = await loadPartialSyncCatalogItems({
        applyEnvLimit: options?.applyEnvLimit === true,
      });
      return {
        items,
        sha: null,
        envelope: { format: "array" },
        raw: items,
        rebuilt: false,
      };
    } catch (error) {
      console.warn(
        "[fanza-sync] partial catalog load failed; using JSON",
        error,
      );
    }
  }

  let handle: CatalogSnapshotHandle;

  if (isGitHubCatalogConfigured()) {
    try {
      handle = await fetchCatalogFromGitHub();
    } catch (error) {
      console.warn("[fanza-sync] GitHub catalog read failed; using local", error);
      const items = readCatalogSnapshot();
      handle = {
        items,
        sha: null,
        envelope: { format: "array" },
        raw: items,
        rebuilt: false,
      };
    }
  } else {
    const items = readCatalogSnapshot();
    handle = {
      items,
      sha: null,
      envelope: { format: "array" },
      raw: items,
      rebuilt: false,
    };
  }

  let items = handle.items;
  if (mode && isAdultPartialSyncMode(mode) && options?.applyEnvLimit) {
    const limit = getAdultLightSyncTargetLimit();
    if (limit > 0) {
      items = items.slice(0, limit);
    }
  }

  return { ...handle, items };
}

/**
 * 掲載情報更新の対象宇宙を安定順で返す。
 * all: 全作品 / unchecked: image_status IS NULL
 * マスター全件 select は行わない。バッチ処理直前に必要列のみ取得する。
 */
async function loadSyncUniverse(
  mode: AdultSyncMode,
  scope: FanzaSyncTargetScope,
): Promise<DmmItem[]> {
  const { items } = await loadCatalogForSync(mode, { applyEnvLimit: false });
  const byCid = buildCatalogByCid(items);

  if (scope === "unchecked") {
    const { supabaseFetchUncheckedImageStatusCids } = await import(
      "@/lib/dmm/works-master/supabase-store"
    );
    const uncheckedCids = await supabaseFetchUncheckedImageStatusCids();
    const ordered: DmmItem[] = [];
    for (const cid of uncheckedCids) {
      ordered.push(byCid.get(cid) ?? minimalSyncStub(cid));
    }
    return ordered;
  }

  return sortWorksForFanzaSyncStable([...byCid.values()]);
}

/** 同一ジョブ内で宇宙の再構築（CID 全列挙）を繰り返さない */
async function loadSyncUniverseForJob(
  jobId: string,
  mode: AdultSyncMode,
  scope: FanzaSyncTargetScope,
): Promise<DmmItem[]> {
  const cached = getSyncUniverseCache();
  if (
    cached &&
    cached.jobId === jobId &&
    cached.mode === mode &&
    cached.scope === scope &&
    Date.now() < cached.expiresAt
  ) {
    return cached.items;
  }

  const items = await loadSyncUniverse(mode, scope);
  setSyncUniverseCache({
    jobId,
    mode,
    scope,
    items,
    expiresAt: Date.now() + 45 * 60 * 1000,
  });
  return items;
}

/** バッチ分だけ同期用の狭い列でマスターを重ねる */
async function enrichSyncBatch(batch: DmmItem[]): Promise<DmmItem[]> {
  if (batch.length === 0) return batch;
  try {
    const { enrichDmmItemsForSync } = await import("@/lib/dmm/works-master");
    const enriched = await enrichDmmItemsForSync(batch);
    // バッチで観測した updated_at でもウォーターマークを進める
    let maxUpdated: string | null = null;
    for (const item of enriched) {
      const ts = item.updatedAt?.trim();
      if (!ts) continue;
      if (!maxUpdated || Date.parse(ts) > Date.parse(maxUpdated)) {
        maxUpdated = ts;
      }
    }
    if (maxUpdated) {
      advanceWorksMasterUpdatedAtWatermark(maxUpdated);
    }
    return enriched;
  } catch (error) {
    console.warn("[fanza-sync] batch enrich skipped", error);
    return batch;
  }
}

const DEFAULT_RUN_LIMIT = 300;
const MAX_RUN_LIMIT = 5000;

function clampRunLimit(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RUN_LIMIT;
  return Math.min(MAX_RUN_LIMIT, Math.max(1, n));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applySyncResults(
  catalogItems: DmmItem[],
  orderedBatch: DmmItem[],
  results: Awaited<ReturnType<typeof syncFanzaProduct>>[],
): DmmItem[] {
  const byId = new Map<string, number>();
  for (let index = 0; index < catalogItems.length; index += 1) {
    byId.set(normalizeCatalogContentId(catalogItems[index].content_id), index);
  }

  const nextItems = [...catalogItems];

  for (let i = 0; i < orderedBatch.length; i += 1) {
    const contentId = normalizeCatalogContentId(orderedBatch[i].content_id);
    const catalogIndex = byId.get(contentId);
    if (catalogIndex == null) continue;
    nextItems[catalogIndex] = results[i].work;
  }

  return nextItems;
}

function buildSnapshotAfterBatch(
  updatedJob: FanzaSyncJob,
  history: FanzaSyncJobSnapshot["history"],
): FanzaSyncJobSnapshot {
  if (updatedJob.status === "running" || updatedJob.status === "pending") {
    return { currentJob: updatedJob, history };
  }

  // failed / partial_failed はカーソル付きで残し、途中再開可能にする
  if (
    updatedJob.status === "failed" ||
    updatedJob.status === "partial_failed"
  ) {
    return {
      currentJob: updatedJob,
      history: [
        toHistoryEntry(updatedJob),
        ...history.filter((entry) => entry.jobId !== updatedJob.jobId),
      ].slice(0, FANZA_SYNC_HISTORY_LIMIT),
    };
  }

  return finalizeSnapshotWithHistory({
    currentJob: updatedJob,
    history: [
      toHistoryEntry(updatedJob),
      ...history.filter((entry) => entry.jobId !== updatedJob.jobId),
    ].slice(0, FANZA_SYNC_HISTORY_LIMIT),
  });
}

function updateJobFromBatch(
  job: FanzaSyncJob,
  batch: DmmItem[],
  results: Awaited<ReturnType<typeof syncFanzaProduct>>[],
): FanzaSyncJob {
  const now = new Date().toISOString();
  let updatedCount = job.updatedCount;
  let unchangedCount = job.unchangedCount;
  let unconfirmedCount = job.unconfirmedCount;
  let hiddenCount = job.hiddenCount;
  let republishedCount = job.republishedCount;
  let errorCount = job.errorCount;
  let successCount = job.successCount;

  for (const result of results) {
    switch (result.outcome) {
      case "updated":
      case "republished":
        updatedCount += 1;
        successCount += 1;
        break;
      case "unchanged":
        unchangedCount += 1;
        successCount += 1;
        break;
      case "not_found":
        unconfirmedCount += 1;
        successCount += 1;
        break;
      case "hidden":
        hiddenCount += 1;
        successCount += 1;
        break;
      case "transport_error":
        errorCount += 1;
        break;
      default:
        break;
    }

    if (result.republished) {
      republishedCount += 1;
    }
  }

  const processedCount = job.processedCount + batch.length;
  const cursor = job.cursor + batch.length;
  const completed = processedCount >= job.targetCount;
  const lastItem = batch[batch.length - 1];
  const runStart = job.runStartOffset ?? 0;
  const endInclusive = processedCount > 0 ? runStart + processedCount - 1 : null;

  return {
    ...job,
    processedCount,
    cursor,
    successCount,
    updatedCount,
    unchangedCount,
    unconfirmedCount,
    hiddenCount,
    republishedCount,
    errorCount,
    lastProcessedContentId: lastItem?.content_id ?? job.lastProcessedContentId,
    updatedAt: now,
    completedAt: completed ? now : null,
    status: completed
      ? errorCount > 0
        ? "partial_failed"
        : "completed"
      : "running",
    message: completed
      ? endInclusive == null
        ? "今回の処理が完了しました。"
        : `今回処理: ${runStart}〜${endInclusive} / 次回開始: ${runStart + processedCount}`
      : `同期中… ${processedCount.toLocaleString()} / ${job.targetCount.toLocaleString()} 件`,
    lockOwner: completed ? null : job.lockOwner,
  };
}

async function persistJobSnapshotToGitHub(
  snapshot: FanzaSyncJobSnapshot,
  message: string,
): Promise<void> {
  if (!isGitHubCatalogConfigured()) return;

  await commitGitHubFilesBundle(
    [serializeFanzaSyncJobFile(snapshot)],
    message,
  );
}

export async function startFanzaSyncJob(input: {
  trigger: FanzaSyncTrigger;
  batchSize?: number;
  mode?: AdultSyncMode;
  /** 1回の処理件数（UI）。未指定時は自動cron向けに環境変数上限を使う */
  limit?: number;
  targetScope?: FanzaSyncTargetScope;
  /** 明示オフセット。未指定なら保存済み nextOffset から */
  startOffset?: number;
  resetCursor?: boolean;
}): Promise<{ job: FanzaSyncJob; alreadyRunning: boolean }> {
  if (!isDmmConfigured()) {
    throw new FanzaSyncError("FANZA API の設定が未完了です。", 503);
  }

  const mode: AdultSyncMode = isAdultSyncMode(input.mode)
    ? input.mode
    : ADULT_SYNC_MODE_LIGHT;

  // 手動実行はトグル/環境変数。自動cronは軽量同期を許可
  if (input.trigger !== "auto") {
    if (isAdultPartialSyncMode(mode) && !resolveLightSyncEnabled()) {
      throw new FanzaSyncError(
        "軽量同期は管理画面でONにするか、ADULT_LIGHT_SYNC_ENABLED=true が必要です",
        403,
      );
    }
    if (mode === ADULT_SYNC_MODE_FULL && !resolveFullSyncEnabled()) {
      throw new FanzaSyncError(
        "完全同期は管理画面でONにするか、ADULT_FULL_SYNC_ENABLED=true が必要です",
        403,
      );
    }
  } else if (mode === ADULT_SYNC_MODE_FULL && !resolveFullSyncEnabled()) {
    throw new FanzaSyncError(
      "自動cronでの完全同期は ADULT_FULL_SYNC_ENABLED=true が必要です",
      403,
    );
  }

  const snapshot = await loadFanzaSyncSnapshot();
  const current = snapshot.currentJob;

  if (
    current &&
    isFanzaSyncJobRunning(current) &&
    !isFanzaSyncJobStale(current, FANZA_SYNC_JOB_STALE_MS)
  ) {
    return { job: current, alreadyRunning: true };
  }

  const targetScope: FanzaSyncTargetScope = isFanzaSyncTargetScope(
    input.targetScope,
  )
    ? input.targetScope
    : "all";

  let job: FanzaSyncJob;

  if (isAdultPartialSyncMode(mode)) {
    // 仮 jobId 前に宇宙を構築し、作成後にキャッシュキーを付け替える
    const universe = await loadSyncUniverse(mode, targetScope);
    const universeCount = universe.length;
    if (universeCount === 0) {
      throw new FanzaSyncError("同期対象が0件です。", 400);
    }

    const runLimit =
      input.limit != null
        ? clampRunLimit(input.limit)
        : (() => {
            const envLimit = getAdultLightSyncTargetLimit();
            return envLimit > 0 ? envLimit : clampRunLimit(DEFAULT_RUN_LIMIT);
          })();

    const progress = loadFanzaSyncProgress().scopes[targetScope];
    let startOffset = 0;
    if (input.resetCursor) {
      startOffset = 0;
    } else if (input.startOffset != null && Number.isFinite(Number(input.startOffset))) {
      startOffset = Math.max(0, Math.floor(Number(input.startOffset)));
    } else {
      startOffset = progress.nextOffset ?? 0;
    }
    if (startOffset >= universeCount) {
      startOffset = 0;
    }

    const runCount = Math.min(runLimit, universeCount - startOffset);
    if (runCount <= 0) {
      throw new FanzaSyncError("今回の処理対象が0件です。", 400);
    }

    const endInclusive = startOffset + runCount - 1;
    job = createFanzaSyncJob({
      trigger: input.trigger,
      targetCount: runCount,
      batchSize: input.batchSize,
      mode,
      targetScope,
      runStartOffset: startOffset,
      runLimit,
      universeCount,
      cursor: startOffset,
    });
    job = {
      ...job,
      message: `同期開始: ${startOffset}〜${endInclusive}（${runCount}件 / 総数 ${universeCount.toLocaleString()}）`,
    };
    setSyncUniverseCache({
      jobId: job.jobId,
      mode,
      scope: targetScope,
      items: universe,
      expiresAt: Date.now() + 45 * 60 * 1000,
    });
  } else {
    const { items } = await loadCatalogForSync(mode, { applyEnvLimit: false });
    job = createFanzaSyncJob({
      trigger: input.trigger,
      targetCount: items.length,
      batchSize: input.batchSize,
      mode,
      targetScope: "all",
      runStartOffset: 0,
      runLimit: items.length,
      universeCount: items.length,
      cursor: 0,
    });
  }

  const nextSnapshot: FanzaSyncJobSnapshot = {
    currentJob: job,
    history: snapshot.history,
  };

  persistFanzaSyncSnapshotLocally(nextSnapshot);

  // 軽量同期は Git へジョブ状態を書かない（差分・デプロイ防止）
  if (!isAdultPartialSyncMode(mode)) {
    try {
      await persistJobSnapshotToGitHub(nextSnapshot, "FANZA sync job started");
    } catch (error) {
      console.warn("[fanza-sync] failed to persist job start to GitHub", error);
    }
  }

  return { job, alreadyRunning: false };
}

/** 失敗・中断ジョブをカーソルから再開（二重実行防止付き） */
export async function resumeFanzaSyncJob(): Promise<{
  job: FanzaSyncJob;
  alreadyRunning: boolean;
  resumed: boolean;
}> {
  if (!isDmmConfigured()) {
    throw new FanzaSyncError("FANZA API の設定が未完了です。", 503);
  }

  const snapshot = await loadFanzaSyncSnapshot();
  const current = snapshot.currentJob;

  if (!current) {
    throw new FanzaSyncError("再開できる同期ジョブがありません。", 404);
  }

  if (
    isFanzaSyncJobRunning(current) &&
    !isFanzaSyncJobStale(current, FANZA_SYNC_JOB_STALE_MS)
  ) {
    return { job: current, alreadyRunning: true, resumed: false };
  }

  if (current.processedCount >= current.targetCount) {
    throw new FanzaSyncError("このジョブは既に完了しています。", 400);
  }

  const mode: AdultSyncMode = isAdultSyncMode(current.mode)
    ? current.mode
    : ADULT_SYNC_MODE_LIGHT;

  if (isAdultPartialSyncMode(mode) && !resolveLightSyncEnabled()) {
    throw new FanzaSyncError(
      "軽量同期は管理画面でONにするか、ADULT_LIGHT_SYNC_ENABLED=true が必要です",
      403,
    );
  }

  const resumedJob: FanzaSyncJob = {
    ...current,
    status: "running",
    message: `途中再開… ${current.processedCount.toLocaleString()} / ${current.targetCount.toLocaleString()} 件から`,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    lockOwner: current.jobId,
  };

  const nextSnapshot: FanzaSyncJobSnapshot = {
    currentJob: resumedJob,
    history: snapshot.history,
  };
  persistFanzaSyncSnapshotLocally(nextSnapshot);

  return { job: resumedJob, alreadyRunning: false, resumed: true };
}

export async function processFanzaSyncBatch(options?: {
  dryRun?: boolean;
}): Promise<{
  job: FanzaSyncJob | null;
  processedInBatch: number;
  committedToGitHub: boolean;
}> {
  const snapshot = await loadFanzaSyncSnapshot();
  const job = snapshot.currentJob;

  if (!job || !isFanzaSyncJobRunning(job)) {
    return { job: null, processedInBatch: 0, committedToGitHub: false };
  }

    if (isFanzaSyncJobStale(job, FANZA_SYNC_JOB_STALE_MS)) {
    const failedJob: FanzaSyncJob = {
      ...job,
      status: "failed",
      message: "同期ジョブがタイムアウトしました。",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lockOwner: null,
    };
    const staleMode = (job.mode as AdultSyncMode) ?? ADULT_SYNC_MODE_FULL;
    if (isAdultPartialSyncMode(staleMode)) {
      advanceFanzaSyncProgress({
        scope: job.targetScope === "unchecked" ? "unchecked" : "all",
        runStartOffset: job.runStartOffset ?? 0,
        processedCount: job.processedCount,
        limit: job.runLimit ?? job.targetCount,
        mode: staleMode,
        universeCount: job.universeCount ?? 0,
      });
    }
    const finalized = finalizeSnapshotWithHistory({
      currentJob: failedJob,
      history: snapshot.history,
    });
    persistFanzaSyncSnapshotLocally(finalized);
    try {
      await persistJobSnapshotToGitHub(finalized, "FANZA sync job timed out");
    } catch (error) {
      console.warn("[fanza-sync] failed to persist timed-out job", error);
    }
    return { job: failedJob, processedInBatch: 0, committedToGitHub: false };
  }

  const mode = (job.mode as AdultSyncMode) ?? ADULT_SYNC_MODE_FULL;
  const targetScope: FanzaSyncTargetScope =
    job.targetScope === "unchecked" ? "unchecked" : "all";

  // 部分同期は安定順＋絶対カーソル。フルは従来の優先度順。
  const sorted = isAdultPartialSyncMode(mode)
    ? await loadSyncUniverseForJob(job.jobId, mode, targetScope)
    : sortWorksForFanzaSync(
        (await loadCatalogForSync(mode, { applyEnvLimit: false })).items,
      );

  const remainingInRun = Math.max(0, job.targetCount - job.processedCount);
  const batchTake = Math.min(job.batchSize, remainingInRun);
  const rawBatch =
    batchTake > 0 ? selectFanzaSyncBatch(sorted, job.cursor, batchTake) : [];
  // 部分同期: バッチ CID 分だけ狭い列でマスターを取得（全件 select 禁止）
  const batch = isAdultPartialSyncMode(mode)
    ? await enrichSyncBatch(rawBatch)
    : rawBatch;

  if (batch.length === 0) {
    const completedJob: FanzaSyncJob = {
      ...job,
      status: job.errorCount > 0 ? "partial_failed" : "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message:
        job.processedCount > 0
          ? `今回の処理が完了しました（${job.runStartOffset ?? 0}〜${(job.runStartOffset ?? 0) + job.processedCount - 1}）。次回開始: ${(job.runStartOffset ?? 0) + job.processedCount}`
          : "全作品の同期が完了しました。",
      lockOwner: null,
    };
    if (isAdultPartialSyncMode(mode)) {
      advanceFanzaSyncProgress({
        scope: targetScope,
        runStartOffset: job.runStartOffset ?? 0,
        processedCount: job.processedCount,
        limit: job.runLimit ?? job.targetCount,
        mode,
        universeCount: job.universeCount ?? sorted.length,
      });
    }
    const finalized = finalizeSnapshotWithHistory({
      currentJob: completedJob,
      history: snapshot.history,
    });
    persistFanzaSyncSnapshotLocally(finalized);
    if (!isAdultPartialSyncMode(mode)) {
      try {
        await persistJobSnapshotToGitHub(finalized, "FANZA sync completed");
      } catch (error) {
        console.warn("[fanza-sync] failed to persist completed job", error);
      }
    }
    return { job: completedJob, processedInBatch: 0, committedToGitHub: false };
  }

  console.log("[fanza-sync] batch start", {
    jobId: job.jobId,
    cursor: job.cursor,
    batchSize: batch.length,
  });

  const results = await mapWithConcurrency(
    batch,
    FANZA_SYNC_DEFAULT_CONCURRENCY,
    (item) =>
      syncFanzaProduct(item, {
        mode,
      }),
  );

  const hitRateLimit = results.some(
    (result) =>
      result.outcome === "transport_error" && result.httpStatus === 429,
  );

  let updatedJob = updateJobFromBatch(job, batch, results);

  if (hitRateLimit) {
    updatedJob = {
      ...updatedJob,
      status: "failed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message:
        "FANZA API が 429（レート制限）を返したため同期を停止しました。途中再開できます。",
      lockOwner: null,
    };
  }

  // 成功済み位置まで進捗を保存（通信エラー・完了を含む）
  if (isAdultPartialSyncMode(mode)) {
    const progress = advanceFanzaSyncProgress({
      scope: targetScope,
      runStartOffset: updatedJob.runStartOffset ?? 0,
      processedCount: updatedJob.processedCount,
      limit: updatedJob.runLimit ?? updatedJob.targetCount,
      mode,
      universeCount: updatedJob.universeCount ?? sorted.length,
    });
    if (updatedJob.status !== "running") {
      const start = updatedJob.runStartOffset ?? 0;
      const end =
        updatedJob.processedCount > 0
          ? start + updatedJob.processedCount - 1
          : null;
      updatedJob = {
        ...updatedJob,
        message:
          end == null
            ? updatedJob.message
            : `今回処理: ${start}〜${end} / 次回開始: ${progress.nextOffset}${
                updatedJob.status === "failed" ||
                updatedJob.status === "partial_failed"
                  ? "（途中停止・進捗保存済み）"
                  : ""
              }`,
      };
    }
  }

  const nextSnapshot = buildSnapshotAfterBatch(updatedJob, snapshot.history);
  const batchUpdatedWorks = results
    .filter(
      (result) =>
        result.outcome === "updated" ||
        result.outcome === "republished" ||
        result.outcome === "hidden",
    )
    .map((result) => result.work);
  const batchUpdatedCount = batchUpdatedWorks.length;

  persistFanzaSyncSnapshotLocally(nextSnapshot);

  if (options?.dryRun) {
    return {
      job: updatedJob,
      processedInBatch: batch.length,
      committedToGitHub: false,
    };
  }

  // 部分同期: Git / カタログJSON / デプロイなし。work_live_status + 画像ステータス更新。
  if (isAdultPartialSyncMode(mode)) {
    if (batchUpdatedCount > 0) {
      await upsertLiveStatusFromWorks(batchUpdatedWorks);
    }

    // 掲載情報更新時のみ image_status を保存（URL判定→必要時のみGET。通常閲覧では再判定しない）
    try {
      const { refreshWorksImageStatusFromDmmItems } = await import(
        "@/lib/admin/refresh-works-image-status"
      );
      const imageStats = await refreshWorksImageStatusFromDmmItems(
        results.map((result) => result.work),
        { concurrency: 4 },
      );
      console.log("[fanza-sync] image_status refresh", imageStats);
      const { revalidateWorksMasterAfterAdd } = await import(
        "@/lib/dmm/works-master"
      );
      await revalidateWorksMasterAfterAdd();
    } catch (error) {
      console.warn("[fanza-sync] image_status refresh failed", error);
    }

    // ジョブ完了・停止時のみ公開キャッシュを無効化（ページ全体 revalidate はしない）
    if (updatedJob.status !== "running") {
      const { revalidateWorkLiveStatusAfterSync } = await import(
        "@/lib/dmm/work-live-status"
      );
      revalidateWorkLiveStatusAfterSync();
    }

    if (
      !hitRateLimit &&
      updatedJob.status === "running" &&
      FANZA_SYNC_BATCH_INTERVAL_MS > 0
    ) {
      await sleep(FANZA_SYNC_BATCH_INTERVAL_MS);
    }

    return {
      job: updatedJob,
      processedInBatch: batch.length,
      committedToGitHub: false,
    };
  }

  if (!isGitHubCatalogConfigured()) {
    throw new FanzaSyncError("GitHub連携の設定が未完了です。", 503);
  }

  let retryCount = 0;
  let committedToGitHub = false;

  while (retryCount <= FANZA_SYNC_COMMIT_MAX_RETRIES) {
    try {
      await persistJobSnapshotToGitHub(
        nextSnapshot,
        `FANZA sync job progress ${updatedJob.processedCount}/${updatedJob.targetCount}`,
      );

      if (batchUpdatedCount === 0) {
        committedToGitHub = true;
        persistFanzaSyncSnapshotLocally(nextSnapshot);
        break;
      }

      // フル同期のみ: カタログ本体を作業ブランチへ書き込む（デプロイはしない）
      const catalog = await fetchCatalogFromGitHub().catch(async () => {
        const items = readCatalogSnapshot();
        return {
          items,
          sha: null,
          envelope: { format: "array" as const },
          raw: items,
          rebuilt: false,
        };
      });
      const previousItems = catalog.items;
      const mergedItems = applySyncResults(previousItems, batch, results);
      const indexFiles = [
        ...serializeCatalogIndexes(
          rebuildAllIndexes(filterPublicCatalogWorks(mergedItems)),
        ),
      ];

      const manifest =
        getCatalogManifest() ??
        ({
          version: 1,
          totalCount: previousItems.length,
          shardSize: 500,
          updatedAt: new Date().toISOString(),
          shards: [],
        } as const);

      if (!manifest.shards.length) {
        await commitCatalogBundleToGitHub(
          catalog.envelope,
          mergedItems,
          `FANZA sync batch ${updatedJob.processedCount}/${updatedJob.targetCount}`,
          indexFiles,
          catalog.raw,
        );
      } else {
        await commitChangedCatalogShardsToGitHub({
          previousItems,
          nextItems: mergedItems,
          previousManifest: manifest,
          commitLabel: `FANZA sync batch ${updatedJob.processedCount}/${updatedJob.targetCount}`,
          indexFiles,
        });
      }

      committedToGitHub = true;
      persistFanzaSyncSnapshotLocally(nextSnapshot);
      break;
    } catch (error) {
      if (
        error instanceof GitHubCatalogError &&
        (error.status === 409 || error.status === 422) &&
        retryCount < FANZA_SYNC_COMMIT_MAX_RETRIES
      ) {
        retryCount += 1;
        continue;
      }

      if (error instanceof IndexRebuildError) {
        throw new FanzaSyncError(error.message, 500);
      }

      throw error;
    }
  }

  console.log("[fanza-sync] batch complete", {
    jobId: updatedJob.jobId,
    processed: updatedJob.processedCount,
    target: updatedJob.targetCount,
    status: updatedJob.status,
  });

  return {
    job: updatedJob,
    processedInBatch: batch.length,
    committedToGitHub,
  };
}

export async function runFanzaSyncUntilDeadline(
  deadlineMs: number,
  trigger: FanzaSyncTrigger = "auto",
): Promise<{ job: FanzaSyncJob | null; alreadyRunning: boolean }> {
  const started = Date.now();
  let snapshot = await loadFanzaSyncSnapshot();
  let alreadyRunning = false;

  if (
    snapshot.currentJob &&
    isFanzaSyncJobRunning(snapshot.currentJob) &&
    !isFanzaSyncJobStale(snapshot.currentJob, FANZA_SYNC_JOB_STALE_MS)
  ) {
    alreadyRunning = true;
  } else {
    const startedJob = await startFanzaSyncJob({ trigger });
    if (startedJob.alreadyRunning) {
      alreadyRunning = true;
    }
    snapshot = await loadFanzaSyncSnapshot();
  }

  let lastJob: FanzaSyncJob | null = snapshot.currentJob;

  while (Date.now() - started < deadlineMs) {
    const result = await processFanzaSyncBatch();
    lastJob = result.job;

    if (!result.job || result.job.status !== "running") {
      break;
    }

    if (result.processedInBatch === 0) {
      break;
    }
  }

  return { job: lastJob, alreadyRunning };
}

export async function getFanzaSyncStatus(): Promise<FanzaSyncJobSnapshot> {
  return loadFanzaSyncSnapshot();
}
