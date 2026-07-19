import "server-only";

import {
  FANZA_EXPAND_DEFAULT_TARGET,
  FANZA_EXPAND_OFFSET_START,
  FANZA_EXPAND_SOURCE_ORDER,
  getFanzaExpandAdminMaxBatchesPerRequest,
  getFanzaExpandBatchSize,
  getFanzaExpandCliMaxBatchesPerLoop,
  getFanzaExpandKeywordMaxOffset,
  getFanzaExpandMaxRetries,
  getFanzaExpandRequestDelayMs,
  getFanzaExpandSortMaxOffset,
  getFanzaExpandUpsertChunkSize,
} from "@/lib/admin/fanza-expand-config";
import {
  expandSourceLabel,
  expandSourceSort,
  getFanzaExpandEntityNames,
  isKeywordExpandSource,
} from "@/lib/admin/fanza-expand-sources";
import {
  readFanzaExpandJob,
  writeFanzaExpandJob,
  writeFanzaExpandJobForCli,
} from "@/lib/admin/fanza-expand-store";
import {
  createEmptySourceStatsMap,
  type FanzaExpandCursor,
  type FanzaExpandJob,
  type FanzaExpandOverview,
  type FanzaExpandSource,
} from "@/lib/admin/fanza-expand-types";
import { getPublishedWorkCount } from "@/lib/admin/stats";
import { isAdultLocalWriteAllowed } from "@/lib/dmm/write-guard";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { enrichCatalogItemMetadata } from "@/lib/dmm/catalog-metadata";
import { isImportCandidateMetadataValid } from "@/lib/dmm/filter";
import {
  appendWorksToCatalogShards,
  clearCatalogShardCache,
  getAllCatalogWorks,
  getCatalogManifest,
  getCatalogShard,
  writeCatalogShardsLocally,
} from "@/lib/dmm/catalog-shards";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { detectAdultImageStatusMany } from "@/lib/works/image-status";
import {
  isMissingAdultImage,
  pickPackageImageCandidate,
} from "@/lib/works/package-image";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * Math.min(250, ms * 0.2));
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = error.message.match(/DMM API request failed: (\d+)/);
  if (!match) return false;
  const status = Number(match[1]);
  return status === 401 || status === 403;
}

function isRetryableError(error: unknown): boolean {
  if (isAuthError(error)) return false;
  if (!(error instanceof Error)) return true;
  const match = error.message.match(/DMM API request failed: (\d+)/);
  if (!match) return true;
  const status = Number(match[1]);
  return status === 429 || status >= 500;
}

function createJobId(): string {
  return `fanza-expand-${Date.now()}`;
}

function persistJob(job: FanzaExpandJob, forCli = false): FanzaExpandJob {
  return forCli ? writeFanzaExpandJobForCli(job) : writeFanzaExpandJob(job);
}

export type FanzaExpandEgressMetrics = {
  supabaseQueries: number;
  columnsRead: string[];
  rowsRead: number;
  estimatedBytes: number;
  startedAtMs: number;
};

type EgressHolder = typeof globalThis & {
  __fanzaExpandEgressMetrics?: FanzaExpandEgressMetrics | null;
};

export function resetFanzaExpandEgressMetrics(): FanzaExpandEgressMetrics {
  const metrics: FanzaExpandEgressMetrics = {
    supabaseQueries: 0,
    columnsRead: [],
    rowsRead: 0,
    estimatedBytes: 0,
    startedAtMs: Date.now(),
  };
  (globalThis as EgressHolder).__fanzaExpandEgressMetrics = metrics;
  return metrics;
}

export function getFanzaExpandEgressMetrics(): FanzaExpandEgressMetrics | null {
  return (globalThis as EgressHolder).__fanzaExpandEgressMetrics ?? null;
}

function recordExpandSupabaseRead(input: {
  columns: string;
  rows: number;
  /** count/head など行ボディが無いとき */
  estimatedBytes?: number;
}): void {
  const metrics = (globalThis as EgressHolder).__fanzaExpandEgressMetrics;
  if (!metrics) return;
  metrics.supabaseQueries += 1;
  if (!metrics.columnsRead.includes(input.columns)) {
    metrics.columnsRead.push(input.columns);
  }
  metrics.rowsRead += Math.max(0, input.rows);
  if (typeof input.estimatedBytes === "number") {
    metrics.estimatedBytes += input.estimatedBytes;
  } else {
    // cid 1 行 ≈ 30B JSON（"cid":"..."）の概算
    metrics.estimatedBytes += Math.max(0, input.rows) * 30;
  }
}

/**
 * 現在作品数は count のみ（行データ取得禁止）。
 * Supabase 未設定時のみローカル manifest 件数にフォールバック。
 */
export async function getFanzaExpandCurrentWorkCount(): Promise<number> {
  try {
    const { countWorkMasterRows } = await import("@/lib/dmm/works-master");
    const count = await countWorkMasterRows();
    if (typeof count === "number" && Number.isFinite(count)) {
      recordExpandSupabaseRead({
        columns: "count(cid) head",
        rows: 0,
        estimatedBytes: 120,
      });
      return count;
    }
  } catch {
    // fall through
  }
  const manifest = getCatalogManifest();
  if (manifest && typeof manifest.totalCount === "number") {
    return manifest.totalCount;
  }
  try {
    return await getPublishedWorkCount();
  } catch {
    return 0;
  }
}

function buildInitialCursor(
  sourceOrder: FanzaExpandSource[],
): FanzaExpandCursor {
  const source = sourceOrder[0] ?? "popular";
  let entityName: string | null = null;
  if (isKeywordExpandSource(source)) {
    entityName = getFanzaExpandEntityNames(source)[0] ?? null;
  }
  return {
    source,
    offset: FANZA_EXPAND_OFFSET_START,
    entityIndex: 0,
    entityName,
  };
}

function normalizeSourceOrder(
  sources?: FanzaExpandSource[],
): FanzaExpandSource[] {
  if (!sources || sources.length === 0) {
    return [...FANZA_EXPAND_SOURCE_ORDER];
  }
  const allowed = new Set<string>(FANZA_EXPAND_SOURCE_ORDER);
  const unique: FanzaExpandSource[] = [];
  for (const source of sources) {
    if (!allowed.has(source)) continue;
    if (unique.includes(source)) continue;
    unique.push(source);
  }
  return unique.length > 0 ? unique : [...FANZA_EXPAND_SOURCE_ORDER];
}

export type StartFanzaExpandOptions = {
  targetCount?: number;
  sourceOrder?: FanzaExpandSource[];
  batchSize?: number;
  upsertChunkSize?: number;
  requestDelayMs?: number;
  dryRun?: boolean;
  resume?: boolean;
  /** CLI は write-guard を緩和 */
  forCli?: boolean;
};

export function startFanzaExpandJob(
  options: StartFanzaExpandOptions = {},
): FanzaExpandJob {
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }

  const forCli = Boolean(options.forCli);
  const existing = readFanzaExpandJob();

  if (existing?.status === "RUNNING") {
    throw new Error(`拡張ジョブが実行中です: ${existing.id}`);
  }

  // Dry Run が再開用ジョブのカーソルを消さないようにする
  if (
    options.dryRun &&
    existing &&
    (existing.status === "PAUSED" || existing.status === "FAILED") &&
    !options.resume
  ) {
    throw new Error(
      `再開可能な拡張ジョブがあります (${existing.id})。先に --resume するか、完了/キャンセルしてから --dry-run してください`,
    );
  }

  if (options.resume) {
    if (
      existing &&
      (existing.status === "PAUSED" ||
        existing.status === "FAILED" ||
        existing.status === "PENDING")
    ) {
      const resumed: FanzaExpandJob = {
        ...existing,
        status: "RUNNING",
        pauseRequested: false,
        stopRequested: false,
        pausedAt: undefined,
        lastError: undefined,
        stopReason: undefined,
        startedAt: existing.startedAt ?? new Date().toISOString(),
      };
      return persistJob(resumed, forCli);
    }
    if (existing?.status === "COMPLETED") {
      throw new Error(
        `目標 ${existing.targetCount.toLocaleString()} 件への拡張は完了済みです`,
      );
    }
  }

  const sourceOrder = normalizeSourceOrder(options.sourceOrder);
  const targetCount = Math.max(
    1,
    options.targetCount ?? FANZA_EXPAND_DEFAULT_TARGET,
  );
  const batchSize = Math.min(
    100,
    Math.max(1, options.batchSize ?? getFanzaExpandBatchSize()),
  );
  const upsertChunkSize = Math.min(
    100,
    Math.max(1, options.upsertChunkSize ?? getFanzaExpandUpsertChunkSize()),
  );

  const job: FanzaExpandJob = {
    id: createJobId(),
    status: "RUNNING",
    targetCount,
    currentWorkCount: 0,
    remainingCount: targetCount,
    sourceOrder,
    cursor: buildInitialCursor(sourceOrder),
    batchSize,
    upsertChunkSize,
    requestDelayMs: options.requestDelayMs ?? getFanzaExpandRequestDelayMs(),
    maxRetries: getFanzaExpandMaxRetries(),
    dryRun: Boolean(options.dryRun),
    apiFetchedCount: 0,
    newAddedCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    noImageExcludedCount: 0,
    errorCount: 0,
    batchesProcessed: 0,
    consecutiveEmptyBatches: 0,
    consecutiveErrors: 0,
    sourceStats: createEmptySourceStatsMap(FANZA_EXPAND_SOURCE_ORDER),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return persistJob(job, forCli);
}

export function requestPauseFanzaExpand(jobId?: string): FanzaExpandJob | null {
  const job = readFanzaExpandJob();
  if (!job) return null;
  if (jobId && job.id !== jobId) return null;
  if (job.status !== "RUNNING") return job;
  return persistJob({ ...job, pauseRequested: true });
}

export function requestResumeFanzaExpand(
  options: StartFanzaExpandOptions = {},
): FanzaExpandJob {
  return startFanzaExpandJob({ ...options, resume: true });
}

export function requestCancelFanzaExpand(
  jobId?: string,
): FanzaExpandJob | null {
  const job = readFanzaExpandJob();
  if (!job) return null;
  if (jobId && job.id !== jobId) return null;
  if (job.status === "COMPLETED" || job.status === "CANCELLED") return job;
  return persistJob({
    ...job,
    status: "CANCELLED",
    stopRequested: false,
    pauseRequested: false,
    stopReason: "cancelled_by_admin",
    completedAt: new Date().toISOString(),
  });
}

function finalizeJob(
  job: FanzaExpandJob,
  status: FanzaExpandJob["status"],
  stopReason: string,
  lastError?: string,
  forCli = false,
): FanzaExpandJob {
  return persistJob(
    {
      ...job,
      status,
      stopReason,
      lastError,
      pauseRequested: false,
      stopRequested: false,
      completedAt:
        status === "PAUSED" ? job.completedAt : new Date().toISOString(),
      pausedAt: status === "PAUSED" ? new Date().toISOString() : job.pausedAt,
    },
    forCli,
  );
}

/**
 * 候補作品の content_id / cid のみ抽出（重複照合用）。
 */
function extractCandidateCids(items: DmmItem[]): string[] {
  const cids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cid =
      normalizeCatalogContentId(item.content_id) ||
      normalizeCatalogContentId(item.product_id) ||
      "";
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    cids.push(cid);
  }
  return cids;
}

/**
 * 候補 ID だけを Supabase に .in 照会（select=cid のみ）。
 * 全件取得・select(*)・JS 全件重複判定はしない。
 */
async function lookupExistingCandidateCids(
  candidateCids: string[],
): Promise<Set<string>> {
  if (candidateCids.length === 0) return new Set();
  const { fetchExistingWorkMasterCids } = await import(
    "@/lib/dmm/works-master"
  );
  const existing = await fetchExistingWorkMasterCids(candidateCids);
  recordExpandSupabaseRead({
    columns: "cid",
    rows: existing.size,
    // 問い合わせ自体のレスポンス概算（ヒット行 + リクエストオーバーヘッド）
    estimatedBytes: existing.size * 30 + 200,
  });
  return existing;
}

async function fetchExpandPage(input: {
  hits: number;
  offset: number;
  sort: "rank" | "date";
  keyword?: string;
  maxRetries: number;
}): Promise<{ items: DmmItem[]; totalCount: number }> {
  const baseDelayMs = Number(process.env.FANZA_SYNC_RETRY_BASE_MS ?? 1000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= input.maxRetries; attempt += 1) {
    try {
      const response = await fetchDmmItemList({
        hits: input.hits,
        offset: input.offset,
        sort: input.sort,
        keyword: input.keyword,
        cache: "no-store",
      });
      return {
        items: response.result.items ?? [],
        totalCount: Number(response.result.total_count ?? 0),
      };
    } catch (error) {
      lastError = error;
      if (isAuthError(error)) throw error;
      if (attempt >= input.maxRetries || !isRetryableError(error)) break;
      await sleep(jitter(baseDelayMs * 2 ** (attempt - 1)));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("FANZA expand ItemList failed after retries");
}

function advanceCursor(
  job: FanzaExpandJob,
  pageItemCount: number,
): FanzaExpandCursor | null {
  const { cursor, sourceOrder } = job;
  const source = cursor.source;

  if (!isKeywordExpandSource(source)) {
    const nextOffset = cursor.offset + Math.max(pageItemCount, job.batchSize);
    if (
      pageItemCount === 0 ||
      nextOffset > getFanzaExpandSortMaxOffset()
    ) {
      return moveToNextSource(sourceOrder, source);
    }
    return {
      ...cursor,
      offset: nextOffset,
    };
  }

  const names = getFanzaExpandEntityNames(source);
  const nextOffset = cursor.offset + Math.max(pageItemCount, job.batchSize);
  if (
    pageItemCount > 0 &&
    nextOffset <= getFanzaExpandKeywordMaxOffset()
  ) {
    return {
      ...cursor,
      offset: nextOffset,
      entityName: names[cursor.entityIndex] ?? cursor.entityName,
    };
  }

  const nextEntityIndex = cursor.entityIndex + 1;
  if (nextEntityIndex < names.length) {
    return {
      source,
      offset: FANZA_EXPAND_OFFSET_START,
      entityIndex: nextEntityIndex,
      entityName: names[nextEntityIndex] ?? null,
    };
  }

  return moveToNextSource(sourceOrder, source);
}

function moveToNextSource(
  sourceOrder: FanzaExpandSource[],
  current: FanzaExpandSource,
): FanzaExpandCursor | null {
  const index = sourceOrder.indexOf(current);
  if (index < 0 || index >= sourceOrder.length - 1) return null;
  const nextSource = sourceOrder[index + 1];
  const names = isKeywordExpandSource(nextSource)
    ? getFanzaExpandEntityNames(nextSource)
    : [];
  return {
    source: nextSource,
    offset: FANZA_EXPAND_OFFSET_START,
    entityIndex: 0,
    entityName: names[0] ?? null,
  };
}

async function persistExpandItems(
  items: DmmItem[],
  precheckedByCid: Record<
    string,
    {
      status: "ok" | "now_printing" | "fetch_failed";
      checkedAt: string;
      packageImage?: string | null;
    }
  >,
  dryRun: boolean,
  upsertChunkSize: number,
): Promise<{ newAdded: number; updated: number }> {
  if (items.length === 0 || dryRun) {
    return { newAdded: dryRun ? items.length : 0, updated: 0 };
  }

  let newAdded = 0;
  const updated = 0;

  // 1) works-master（CMS）
  try {
    const {
      getConfiguredWorksMasterBackend,
      upsertWorksMasterFromDmmItems,
      revalidateWorksMasterAfterAdd,
    } = await import("@/lib/dmm/works-master");
    if (getConfiguredWorksMasterBackend() !== "off") {
      for (let i = 0; i < items.length; i += upsertChunkSize) {
        const chunk = items.slice(i, i + upsertChunkSize);
        const result = await upsertWorksMasterFromDmmItems(chunk, {
          published: true,
          precheckedByCid,
        });
        newAdded += result.upserted;
      }
      try {
        const { upsertLiveStatusFromWorks } = await import(
          "@/lib/dmm/work-live-status"
        );
        await upsertLiveStatusFromWorks(items);
      } catch (error) {
        console.warn("[fanza-expand] live status upsert skipped", error);
      }
      await revalidateWorksMasterAfterAdd();
    }
  } catch (error) {
    console.warn("[fanza-expand] works-master upsert skipped", error);
  }

  // 2) ローカル catalog shards（公開 JSON）
  try {
    const manifest = getCatalogManifest();
    if (!manifest) {
      throw new Error("catalog manifest missing");
    }
    const lastMeta = manifest.shards[manifest.shards.length - 1];
    const lastShardWorks = lastMeta ? getCatalogShard(lastMeta.file) : [];
    const append = appendWorksToCatalogShards(
      manifest,
      lastShardWorks,
      items,
    );
    writeCatalogShardsLocally(append.manifest, append.changedShards);
    clearCatalogShardCache();
    if (newAdded === 0) {
      newAdded = items.length;
    }
  } catch (error) {
    console.error("[fanza-expand] catalog shard append failed", error);
    throw error instanceof Error
      ? error
      : new Error("catalog shard append failed");
  }

  void updated;
  return { newAdded, updated };
}

export async function processFanzaExpandBatch(
  options: { forCli?: boolean } = {},
): Promise<{ job: FanzaExpandJob; continueRunning: boolean }> {
  const forCli = Boolean(options.forCli);
  let job = readFanzaExpandJob();
  if (!job) throw new Error("Expand job not found");
  if (job.status !== "RUNNING") {
    return { job, continueRunning: false };
  }

  if (job.stopRequested) {
    return {
      job: finalizeJob(job, "CANCELLED", "cancelled", undefined, forCli),
      continueRunning: false,
    };
  }
  if (job.pauseRequested) {
    return {
      job: finalizeJob(job, "PAUSED", "paused_by_admin", undefined, forCli),
      continueRunning: false,
    };
  }

  const currentWorkCount = await getFanzaExpandCurrentWorkCount();
  job = {
    ...job,
    currentWorkCount,
    remainingCount: Math.max(0, job.targetCount - currentWorkCount),
  };

  if (currentWorkCount >= job.targetCount) {
    return {
      job: finalizeJob(
        job,
        "COMPLETED",
        "target_reached",
        undefined,
        forCli,
      ),
      continueRunning: false,
    };
  }

  const { cursor } = job;
  const source = cursor.source;
  const sort = expandSourceSort(source);
  const keyword = isKeywordExpandSource(source)
    ? cursor.entityName ?? undefined
    : undefined;

  if (isKeywordExpandSource(source) && !keyword) {
    const next = moveToNextSource(job.sourceOrder, source);
    if (!next) {
      return {
        job: finalizeJob(
          job,
          "COMPLETED",
          "sources_exhausted",
          undefined,
          forCli,
        ),
        continueRunning: false,
      };
    }
    job = persistJob({ ...job, cursor: next }, forCli);
    return { job, continueRunning: true };
  }

  let page: { items: DmmItem[]; totalCount: number };
  try {
    page = await fetchExpandPage({
      hits: job.batchSize,
      offset: cursor.offset,
      sort,
      keyword,
      maxRetries: job.maxRetries,
    });
    job.consecutiveErrors = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job = persistJob(
      {
        ...job,
        consecutiveErrors: job.consecutiveErrors + 1,
        errorCount: job.errorCount + 1,
        lastError: message,
        lastFetchAt: new Date().toISOString(),
        sourceStats: {
          ...job.sourceStats,
          [source]: {
            ...job.sourceStats[source],
            errorCount: job.sourceStats[source].errorCount + 1,
            lastFetchAt: new Date().toISOString(),
          },
        },
      },
      forCli,
    );
    if (isAuthError(error) || job.consecutiveErrors >= 5) {
      return {
        job: finalizeJob(job, "FAILED", "api_error", message, forCli),
        continueRunning: false,
      };
    }
    await sleep(jitter(job.requestDelayMs * 2));
    return { job, continueRunning: true };
  }

  // 候補 ID のみ抽出 → Supabase は .in(cid) + select(cid) のみ
  const candidateCids = extractCandidateCids(page.items);
  const existingCids = await lookupExistingCandidateCids(candidateCids);
  const batchCids = new Set<string>();
  let duplicateCount = 0;
  let noImageExcluded = 0;
  const candidates: DmmItem[] = [];

  for (let index = 0; index < page.items.length; index += 1) {
    const raw = page.items[index];
    if (!isImportCandidateMetadataValid(raw)) {
      noImageExcluded += 1;
      continue;
    }

    const cid =
      normalizeCatalogContentId(raw.content_id) ||
      normalizeCatalogContentId(raw.product_id) ||
      "";
    if (!cid) {
      noImageExcluded += 1;
      continue;
    }
    if (existingCids.has(cid) || batchCids.has(cid)) {
      duplicateCount += 1;
      continue;
    }

    const packageImage = pickPackageImageCandidate(raw);
    if (!packageImage || isMissingAdultImage(packageImage)) {
      noImageExcluded += 1;
      continue;
    }

    const rank =
      source === "popular" ? cursor.offset + index : null;
    const newRank = source === "new" ? cursor.offset + index : null;
    const prepared = enrichCatalogItemMetadata(
      {
        ...raw,
        content_id: cid,
        product_id: raw.product_id?.trim() || cid,
      },
      {
        sourcePopularityRank: rank,
        fanzaNewRank: newRank,
      },
    );

    batchCids.add(cid);
    candidates.push(prepared);
  }

  const packageImages = candidates.map((item) =>
    pickPackageImageCandidate(item),
  );
  const imageStatuses = await detectAdultImageStatusMany(packageImages, 3);
  const okItems: DmmItem[] = [];
  const precheckedByCid: Record<
    string,
    {
      status: "ok" | "now_printing" | "fetch_failed";
      checkedAt: string;
      packageImage?: string | null;
    }
  > = {};

  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    const status = imageStatuses[i]?.status ?? "fetch_failed";
    const checkedAt =
      imageStatuses[i]?.checkedAt ?? new Date().toISOString();
    const cid = normalizeCatalogContentId(item.content_id) || item.content_id;
    if (status !== "ok") {
      noImageExcluded += 1;
      continue;
    }
    precheckedByCid[cid] = {
      status: "ok",
      checkedAt,
      packageImage: packageImages[i],
    };
    okItems.push(item);
    existingCids.add(cid);
  }

  const slotsLeft = Math.max(0, job.targetCount - currentWorkCount);
  const toAdd = okItems.slice(0, slotsLeft);

  let persist: { newAdded: number; updated: number };
  try {
    persist = await persistExpandItems(
      toAdd,
      precheckedByCid,
      job.dryRun,
      job.upsertChunkSize,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job = persistJob(
      {
        ...job,
        errorCount: job.errorCount + 1,
        consecutiveErrors: job.consecutiveErrors + 1,
        lastError: message,
      },
      forCli,
    );
    if (job.consecutiveErrors >= 5) {
      return {
        job: finalizeJob(job, "FAILED", "persist_error", message, forCli),
        continueRunning: false,
      };
    }
    await sleep(jitter(job.requestDelayMs * 2));
    return { job, continueRunning: true };
  }

  const nextCursor = advanceCursor(
    { ...job, cursor },
    page.items.length,
  );

  const now = new Date().toISOString();
  const sourceStat = job.sourceStats[source];
  const nextSourceStats = {
    ...job.sourceStats,
    [source]: {
      ...sourceStat,
      apiFetchedCount: sourceStat.apiFetchedCount + page.items.length,
      newAddedCount: sourceStat.newAddedCount + persist.newAdded,
      updatedCount: sourceStat.updatedCount + persist.updated,
      duplicateCount: sourceStat.duplicateCount + duplicateCount,
      noImageExcludedCount: sourceStat.noImageExcludedCount + noImageExcluded,
      lastOffset: cursor.offset,
      lastEntityIndex: cursor.entityIndex,
      lastEntityName: cursor.entityName,
      lastFetchAt: now,
    },
  };

  const afterCount = await getFanzaExpandCurrentWorkCount();
  const emptyBatch = persist.newAdded === 0;

  job = persistJob(
    {
      ...job,
      apiFetchedCount: job.apiFetchedCount + page.items.length,
      newAddedCount: job.newAddedCount + persist.newAdded,
      updatedCount: job.updatedCount + persist.updated,
      duplicateCount: job.duplicateCount + duplicateCount,
      noImageExcludedCount: job.noImageExcludedCount + noImageExcluded,
      batchesProcessed: job.batchesProcessed + 1,
      consecutiveEmptyBatches: emptyBatch
        ? job.consecutiveEmptyBatches + 1
        : 0,
      currentWorkCount: afterCount,
      remainingCount: Math.max(0, job.targetCount - afterCount),
      cursor: nextCursor ?? job.cursor,
      sourceStats: nextSourceStats,
      lastFetchAt: now,
      lastError: undefined,
    },
    forCli,
  );

  await sleep(jitter(job.requestDelayMs));

  if (afterCount >= job.targetCount) {
    return {
      job: finalizeJob(
        job,
        "COMPLETED",
        "target_reached",
        undefined,
        forCli,
      ),
      continueRunning: false,
    };
  }

  if (!nextCursor) {
    return {
      job: finalizeJob(
        job,
        "COMPLETED",
        "sources_exhausted",
        undefined,
        forCli,
      ),
      continueRunning: false,
    };
  }

  // キーワードが尽きた直後は連続空が続く場合があるが、ソース切替で継続
  if (job.consecutiveEmptyBatches >= 80 && isKeywordExpandSource(source)) {
    // 同一ソースで長時間新規ゼロなら次ソースへ
    const forced = moveToNextSource(job.sourceOrder, source);
    if (!forced) {
      return {
        job: finalizeJob(
          job,
          "COMPLETED",
          "no_new_items",
          undefined,
          forCli,
        ),
        continueRunning: false,
      };
    }
    job = persistJob(
      { ...job, cursor: forced, consecutiveEmptyBatches: 0 },
      forCli,
    );
  }

  return { job, continueRunning: true };
}

export async function processFanzaExpandRequestSlice(
  options: { forCli?: boolean; maxBatches?: number } = {},
): Promise<{
  job: FanzaExpandJob;
  continueRunning: boolean;
  batchesRun: number;
}> {
  const maxBatches =
    options.maxBatches ??
    (options.forCli
      ? getFanzaExpandCliMaxBatchesPerLoop()
      : getFanzaExpandAdminMaxBatchesPerRequest());

  let batchesRun = 0;
  let continueRunning = true;
  let job = readFanzaExpandJob();
  if (!job) throw new Error("Expand job not found");

  while (continueRunning && batchesRun < maxBatches) {
    const result = await processFanzaExpandBatch({ forCli: options.forCli });
    job = result.job;
    continueRunning = result.continueRunning;
    batchesRun += 1;
    if (!continueRunning) break;
  }

  return { job, continueRunning, batchesRun };
}

export async function runFanzaExpandUntilIdle(
  options: { forCli?: boolean; maxBatchesTotal?: number } = {},
): Promise<FanzaExpandJob> {
  const jobAtStart = readFanzaExpandJob();
  const dryRun = Boolean(jobAtStart?.dryRun);
  // Dry Run は 100 件（1 バッチ）だけ処理して停止
  const maxBatchesTotal =
    options.maxBatchesTotal ??
    (dryRun ? 1 : Number.POSITIVE_INFINITY);
  const loopSize = dryRun
    ? 1
    : getFanzaExpandCliMaxBatchesPerLoop();

  let batchesTotal = 0;
  let result = await processFanzaExpandRequestSlice({
    forCli: options.forCli,
    maxBatches: Math.min(loopSize, maxBatchesTotal),
  });
  batchesTotal += result.batchesRun;

  while (
    result.continueRunning &&
    batchesTotal < maxBatchesTotal
  ) {
    const remaining = maxBatchesTotal - batchesTotal;
    result = await processFanzaExpandRequestSlice({
      forCli: options.forCli,
      maxBatches: Math.min(loopSize, remaining),
    });
    batchesTotal += result.batchesRun;
  }

  if (dryRun && result.job.status === "RUNNING") {
    result = {
      ...result,
      job: finalizeJob(
        result.job,
        "COMPLETED",
        "dry_run_complete",
        undefined,
        Boolean(options.forCli),
      ),
      continueRunning: false,
    };
  }

  if (!dryRun) {
    try {
      const { rebuildAllIndexes } = await import("@/lib/dmm/index-builders");
      rebuildAllIndexes(getAllCatalogWorks());
    } catch (error) {
      console.warn("[fanza-expand] final index rebuild skipped", error);
    }
  }

  return result.job;
}

export async function getFanzaExpandOverview(): Promise<FanzaExpandOverview> {
  const job = readFanzaExpandJob();
  const currentWorkCount = await getFanzaExpandCurrentWorkCount();
  const targetCount = job?.targetCount ?? FANZA_EXPAND_DEFAULT_TARGET;
  const remainingCount = Math.max(0, targetCount - currentWorkCount);
  const writeAllowed = isAdultLocalWriteAllowed();
  const localCliCommand = `npm run fanza:expand -- --target=${targetCount}`;

  let notice: string;
  if (!writeAllowed) {
    notice =
      "本番では重い拡張を実行しません。Mac ローカルで CLI を実行してください。到達後は差分同期のみ行います。";
  } else if (currentWorkCount >= targetCount) {
    notice =
      "目標件数に到達しています。追加の大量取得は不要です。差分更新（FANZA同期）のみ実行してください。";
  } else {
    notice = `現在 ${currentWorkCount.toLocaleString()} 件。残り ${remainingCount.toLocaleString()} 件。ソース順: ${FANZA_EXPAND_SOURCE_ORDER.map(expandSourceLabel).join(" → ")}`;
  }

  return {
    job,
    currentWorkCount,
    targetCount,
    remainingCount,
    running: job?.status === "RUNNING",
    writeAllowed,
    localCliCommand,
    notice,
  };
}
