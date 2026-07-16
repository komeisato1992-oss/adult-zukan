import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import {
  applyLiveStatusToItem,
  dmmItemToLiveStatusRow,
  liveStatusRowsEqual,
} from "@/lib/dmm/work-live-status/map";
import {
  invalidateLocalLiveStatusCache,
  localCountLiveStatusRows,
  localFetchAllLiveStatusCids,
  localFetchLiveStatusByCids,
  localUpsertLiveStatusRows,
  getLocalLiveStatusMtimeMs,
} from "@/lib/dmm/work-live-status/local-store";
import {
  recordWorkLiveStatusMetrics,
  getWorkLiveStatusMetricsSummary,
} from "@/lib/dmm/work-live-status/metrics";
import {
  supabaseCountLiveStatusRowsDetailed,
  supabaseFetchAllLiveStatusCids,
  supabaseFetchLiveStatusByCids,
  supabaseInsertLiveStatusRowsIgnoreExisting,
  supabaseUpsertLiveStatusRows,
} from "@/lib/dmm/work-live-status/supabase-store";
import {
  getConfiguredWorkLiveStatusBackend,
  getWorkLiveStatusRevalidateSec,
  getWorkLiveStatusRuntimeStatus,
  type WorkLiveStatusBackend,
  type WorkLiveStatusRow,
  type WorkLiveStatusRuntimeStatus,
  type WorkLiveStatusUpsertInput,
} from "@/lib/dmm/work-live-status/types";

export const WORK_LIVE_STATUS_CACHE_TAG = "work-live-status";

export type WorkLiveStatusStorageInfo = {
  backend: WorkLiveStatusBackend;
  label: string;
  rowCount: number | null;
  countStatus: "ok" | "connection_error" | "table_missing" | "fetch_failed";
  countMessage: string | null;
  deployRequired: false;
  runtime: WorkLiveStatusRuntimeStatus;
};

export type MergeLiveStatusResult = {
  items: DmmItem[];
  requestedCount: number;
  dbHitCount: number;
  jsonFallbackCount: number;
  dbFetchMs: number;
  totalMs: number;
  cacheHit: boolean;
};

type ProcessCacheEntry = {
  expiresAt: number;
  rows: Record<string, WorkLiveStatusRow>;
};

type ProcessCacheHolder = typeof globalThis & {
  __workLiveStatusProcessCache?: Map<string, ProcessCacheEntry>;
};

function getProcessCache(): Map<string, ProcessCacheEntry> {
  const g = globalThis as ProcessCacheHolder;
  if (!g.__workLiveStatusProcessCache) {
    g.__workLiveStatusProcessCache = new Map();
  }
  return g.__workLiveStatusProcessCache;
}

export function getWorkLiveStatusStorageLabel(
  backend: WorkLiveStatusBackend = getConfiguredWorkLiveStatusBackend(),
): string {
  if (backend === "supabase") return "Supabase";
  if (backend === "local") return "ローカルDBファイル（Supabase未設定時）";
  return "既存JSON（フォールバック）";
}

function normalizeCids(cids: string[]): string[] {
  return [
    ...new Set(
      cids
        .map((cid) => normalizeCatalogContentId(cid))
        .filter((cid): cid is string => Boolean(cid)),
    ),
  ].sort();
}

async function fetchLiveStatusByCidsUncached(
  cids: string[],
): Promise<Map<string, WorkLiveStatusRow>> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off" || cids.length === 0) {
    return new Map();
  }

  try {
    if (backend === "supabase") {
      return await supabaseFetchLiveStatusByCids(cids);
    }
    return await localFetchLiveStatusByCids(cids);
  } catch (error) {
    console.warn(
      "[work-live-status] fetch failed; falling back to catalog JSON",
      error,
    );
    return new Map();
  }
}

async function fetchLiveStatusByCidsWithCache(
  normalized: string[],
): Promise<{ map: Map<string, WorkLiveStatusRow>; cacheHit: boolean }> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off" || normalized.length === 0) {
    return { map: new Map(), cacheHit: false };
  }

  const revalidateSec = getWorkLiveStatusRevalidateSec();
  const localStamp =
    backend === "local" ? String(getLocalLiveStatusMtimeMs()) : "remote";
  const cacheKey = `${backend}:${localStamp}:${normalized.join(",")}`;
  const processCache = getProcessCache();
  const cached = processCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      map: new Map(Object.entries(cached.rows)),
      cacheHit: true,
    };
  }

  let map: Map<string, WorkLiveStatusRow>;

  // 同期完了時の revalidateTag('work-live-status') で公開反映するため、
  // ローカル/Supabaseとも tagged cache を使う（ページ全体 revalidate はしない）
  if (normalized.length <= 64) {
    try {
      const cachedFn = unstable_cache(
        async () => {
          const rows = await fetchLiveStatusByCidsUncached(normalized);
          return Object.fromEntries(rows.entries());
        },
        ["work-live-status", cacheKey],
        { revalidate: revalidateSec, tags: [WORK_LIVE_STATUS_CACHE_TAG] },
      );
      const obj = await cachedFn();
      map = new Map(Object.entries(obj));
    } catch {
      map = await fetchLiveStatusByCidsUncached(normalized);
    }
  } else {
    map = await fetchLiveStatusByCidsUncached(normalized);
  }

  processCache.set(cacheKey, {
    expiresAt: Date.now() + revalidateSec * 1000,
    rows: Object.fromEntries(map.entries()),
  });

  return { map, cacheHit: false };
}

/** CID 一覧を一括取得（一覧は必ずこちら。個別クエリ禁止） */
export async function fetchLiveStatusByCids(
  cids: string[],
): Promise<Map<string, WorkLiveStatusRow>> {
  const normalized = normalizeCids(cids);
  if (normalized.length === 0) return new Map();
  const { map } = await fetchLiveStatusByCidsWithCache(normalized);
  return map;
}

export async function mergeLiveStatusIntoItemsDetailed(
  items: DmmItem[],
): Promise<MergeLiveStatusResult> {
  const started = Date.now();
  const backend = getConfiguredWorkLiveStatusBackend();

  if (items.length === 0 || backend === "off") {
    return {
      items,
      requestedCount: items.length,
      dbHitCount: 0,
      jsonFallbackCount: items.length,
      dbFetchMs: 0,
      totalMs: Date.now() - started,
      cacheHit: false,
    };
  }

  const fetchStarted = Date.now();
  const normalized = normalizeCids(items.map((item) => item.content_id));
  const { map, cacheHit } = await fetchLiveStatusByCidsWithCache(normalized);
  const dbFetchMs = Date.now() - fetchStarted;

  let dbHitCount = 0;
  const merged = items.map((item) => {
    const cid = normalizeCatalogContentId(item.content_id);
    const row = cid ? map.get(cid) : undefined;
    if (row) dbHitCount += 1;
    return applyLiveStatusToItem(item, row);
  });

  const result: MergeLiveStatusResult = {
    items: merged,
    requestedCount: items.length,
    dbHitCount,
    jsonFallbackCount: items.length - dbHitCount,
    dbFetchMs,
    totalMs: Date.now() - started,
    cacheHit,
  };

  recordWorkLiveStatusMetrics({
    requestedCount: result.requestedCount,
    dbHitCount: result.dbHitCount,
    jsonFallbackCount: result.jsonFallbackCount,
    dbFetchMs: result.dbFetchMs,
    totalMs: result.totalMs,
    cacheHit: result.cacheHit,
    backend,
  });

  return result;
}

/** 表示用作品配列へ変動情報を一括マージ（ページ分 CID のみ渡すこと） */
export async function mergeLiveStatusIntoItems(
  items: DmmItem[],
): Promise<DmmItem[]> {
  const result = await mergeLiveStatusIntoItemsDetailed(items);
  return result.items;
}

/** 作品詳細用: 単一 CID */
export async function mergeLiveStatusIntoItem(
  item: DmmItem | null,
): Promise<DmmItem | null> {
  if (!item) return null;
  const [merged] = await mergeLiveStatusIntoItems([item]);
  return merged ?? item;
}

export async function upsertLiveStatusFromWorks(
  works: DmmItem[],
): Promise<{ upserted: number; unchanged: number; backend: WorkLiveStatusBackend }> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off") {
    return { upserted: 0, unchanged: 0, backend };
  }

  const now = new Date().toISOString();
  const candidates = works
    .map((work) => dmmItemToLiveStatusRow(work, { checkedAt: now }))
    .filter((row): row is WorkLiveStatusUpsertInput => Boolean(row));

  if (candidates.length === 0) {
    return { upserted: 0, unchanged: 0, backend };
  }

  const existing = await fetchLiveStatusByCidsUncached(
    candidates.map((row) => row.cid),
  );

  const changed: WorkLiveStatusUpsertInput[] = [];
  let unchanged = 0;
  for (const row of candidates) {
    const prev = existing.get(row.cid);
    // FANZA APIに見放題APIはない。同期時に既存TV判定を潰さない。
    const merged: WorkLiveStatusUpsertInput = {
      ...row,
      manual_hidden: prev?.manual_hidden ?? row.manual_hidden ?? false,
      sale_start_at: row.sale_start_at ?? prev?.sale_start_at ?? null,
      fanza_tv_status: prev?.fanza_tv_status ?? row.fanza_tv_status ?? null,
      fanza_tv_checked_at:
        prev?.fanza_tv_checked_at ?? row.fanza_tv_checked_at ?? null,
      fanza_tv_changed_at:
        prev?.fanza_tv_changed_at ?? row.fanza_tv_changed_at ?? null,
      fanza_tv_source: prev?.fanza_tv_source ?? row.fanza_tv_source ?? null,
      fanza_tv_error: prev?.fanza_tv_error ?? row.fanza_tv_error ?? null,
    };
    if (liveStatusRowsEqual(merged, prev)) {
      unchanged += 1;
      continue;
    }
    changed.push(merged);
  }

  if (changed.length === 0) {
    return { upserted: 0, unchanged, backend };
  }

  if (backend === "supabase") {
    await supabaseUpsertLiveStatusRows(changed);
  } else {
    await localUpsertLiveStatusRows(changed);
  }

  // プロセスキャッシュのみ破棄。revalidateTag は同期ジョブ完了時のみ。
  invalidateLocalLiveStatusCache();
  getProcessCache().clear();

  const { invalidateDmmStaticWorksCache } = await import(
    "@/lib/dmm/static-works"
  );
  invalidateDmmStaticWorksCache();

  return { upserted: changed.length, unchanged, backend };
}

/** 軽量同期ジョブ完了時のみ呼ぶ */
export function revalidateWorkLiveStatusAfterSync(): void {
  invalidateLocalLiveStatusCache();
  getProcessCache().clear();
  try {
    revalidateTag(WORK_LIVE_STATUS_CACHE_TAG);
  } catch {
    // build / non-Next context
  }
}

export async function getWorkLiveStatusStorageInfo(): Promise<
  WorkLiveStatusStorageInfo & {
    metrics: ReturnType<typeof getWorkLiveStatusMetricsSummary>;
  }
> {
  const backend = getConfiguredWorkLiveStatusBackend();
  let rowCount: number | null = null;
  let countStatus: WorkLiveStatusStorageInfo["countStatus"] = "ok";
  let countMessage: string | null = null;
  let tableAvailable: boolean | null = null;

  try {
    if (backend === "supabase") {
      const detailed = await supabaseCountLiveStatusRowsDetailed();
      rowCount = detailed.count;
      countStatus = detailed.status;
      countMessage = detailed.message;
      tableAvailable = detailed.status === "ok" || detailed.status === "fetch_failed"
        ? detailed.status === "ok" || detailed.count != null
        : detailed.status !== "table_missing";
      if (detailed.status === "ok") tableAvailable = true;
      if (detailed.status === "table_missing") tableAvailable = false;
      if (detailed.status === "connection_error") tableAvailable = null;
    } else if (backend === "local") {
      rowCount = await localCountLiveStatusRows();
      countStatus = "ok";
      tableAvailable = true;
    } else {
      rowCount = null;
      countStatus = "fetch_failed";
      countMessage = "変動情報が無効です";
      tableAvailable = false;
    }
  } catch (error) {
    rowCount = null;
    countStatus = "fetch_failed";
    countMessage = "取得失敗";
    tableAvailable = null;
    console.warn("[work-live-status] storage info failed", error);
  }

  const runtime = getWorkLiveStatusRuntimeStatus({ tableAvailable });

  return {
    backend,
    label: getWorkLiveStatusStorageLabel(backend),
    rowCount,
    countStatus,
    countMessage,
    deployRequired: false,
    runtime,
    metrics: getWorkLiveStatusMetricsSummary(),
  };
}

/**
 * works / work_live_status の差分件数だけ取得（書き込みなし）。
 */
export async function getLiveStatusInitCounts(): Promise<{
  worksCount: number;
  liveStatusCount: number;
  missingCount: number;
  backend: WorkLiveStatusBackend;
}> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off") {
    throw new Error("work_live_status が無効です");
  }

  const { getPublishedWorksMasterContentIdSet } = await import(
    "@/lib/dmm/works-master"
  );
  const publishedCids = await getPublishedWorksMasterContentIdSet();
  const worksCount = publishedCids.size;

  const existingList =
    backend === "supabase"
      ? await supabaseFetchAllLiveStatusCids()
      : await localFetchAllLiveStatusCids();
  const existingCids = new Set(existingList);
  const liveStatusCount = existingCids.size;

  let missingCount = 0;
  for (const cid of publishedCids) {
    if (!existingCids.has(cid)) missingCount += 1;
  }

  return { worksCount, liveStatusCount, missingCount, backend };
}

/**
 * works にあるが work_live_status に無い CID を初期化（既存は上書きしない）。
 * Git / JSON / デプロイは発生させない。
 */
export async function initializeMissingLiveStatus(options?: {
  limit?: number;
}): Promise<{
  worksCount: number;
  liveStatusCount: number;
  missingBefore: number;
  inserted: number;
  remaining: number;
  failed: number;
  backend: WorkLiveStatusBackend;
}> {
  const limit = Math.max(1, Math.min(100, Math.floor(options?.limit ?? 100)));
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off") {
    throw new Error("work_live_status が無効です");
  }

  const { getPublishedWorksMasterContentIdSet, fetchWorkMasterByCids } =
    await import("@/lib/dmm/works-master");
  const { workMasterRowToDmmItem } = await import("@/lib/dmm/works-master/map");

  const publishedCids = [...(await getPublishedWorksMasterContentIdSet())];
  const worksCount = publishedCids.length;

  const existingList =
    backend === "supabase"
      ? await supabaseFetchAllLiveStatusCids()
      : await localFetchAllLiveStatusCids();
  const existingCids = new Set(existingList);

  const missingCids = publishedCids.filter((cid) => !existingCids.has(cid));
  const missingBefore = missingCids.length;
  const batchCids = missingCids.slice(0, limit);

  if (batchCids.length === 0) {
    return {
      worksCount,
      liveStatusCount: existingCids.size,
      missingBefore,
      inserted: 0,
      remaining: 0,
      failed: 0,
      backend,
    };
  }

  const rowsMap = await fetchWorkMasterByCids(batchCids);
  const now = new Date().toISOString();
  const rows: WorkLiveStatusUpsertInput[] = [];
  let failed = 0;
  for (const cid of batchCids) {
    const master = rowsMap.get(cid);
    if (!master) {
      failed += 1;
      continue;
    }
    const row = dmmItemToLiveStatusRow(workMasterRowToDmmItem(master), {
      checkedAt: now,
    });
    if (!row) {
      failed += 1;
      continue;
    }
    rows.push(row);
  }

  let inserted = 0;
  if (rows.length > 0) {
    if (backend === "supabase") {
      const result = await supabaseInsertLiveStatusRowsIgnoreExisting(rows);
      inserted = result.inserted;
    } else {
      await localUpsertLiveStatusRows(rows);
      inserted = rows.length;
    }
    invalidateLocalLiveStatusCache();
    getProcessCache().clear();
  }

  return {
    worksCount,
    liveStatusCount: existingCids.size + inserted,
    missingBefore,
    inserted,
    remaining: Math.max(0, missingBefore - inserted),
    failed,
    backend,
  };
}

/** 指定 CID のみ初期化（既存は上書きしない）。ジョブの pending リスト向け。 */
export async function initializeMissingLiveStatusByCids(
  cids: string[],
): Promise<{
  inserted: number;
  failed: number;
  backend: WorkLiveStatusBackend;
}> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off") {
    throw new Error("work_live_status が無効です");
  }
  if (cids.length === 0) {
    return { inserted: 0, failed: 0, backend };
  }

  const { fetchWorkMasterByCids } = await import("@/lib/dmm/works-master");
  const { workMasterRowToDmmItem } = await import("@/lib/dmm/works-master/map");

  const existing =
    backend === "supabase"
      ? await supabaseFetchLiveStatusByCids(cids)
      : await localFetchLiveStatusByCids(cids);

  const targetCids = cids.filter((cid) => !existing.has(cid));
  if (targetCids.length === 0) {
    return { inserted: 0, failed: 0, backend };
  }

  const rowsMap = await fetchWorkMasterByCids(targetCids);
  const now = new Date().toISOString();
  const rows: WorkLiveStatusUpsertInput[] = [];
  let failed = 0;
  for (const cid of targetCids) {
    const master = rowsMap.get(cid);
    if (!master) {
      failed += 1;
      continue;
    }
    const row = dmmItemToLiveStatusRow(workMasterRowToDmmItem(master), {
      checkedAt: now,
    });
    if (!row) {
      failed += 1;
      continue;
    }
    rows.push(row);
  }

  let inserted = 0;
  if (rows.length > 0) {
    if (backend === "supabase") {
      const result = await supabaseInsertLiveStatusRowsIgnoreExisting(rows);
      inserted = result.inserted;
    } else {
      await localUpsertLiveStatusRows(rows);
      inserted = rows.length;
    }
    invalidateLocalLiveStatusCache();
    getProcessCache().clear();
  }

  return { inserted, failed, backend };
}

export function invalidateWorkLiveStatusCaches(): void {
  revalidateWorkLiveStatusAfterSync();
}

export {
  dmmItemToLiveStatusRow,
  applyLiveStatusToItem,
} from "@/lib/dmm/work-live-status/map";
export type {
  WorkLiveStatusBackend,
  WorkLiveStatusRow,
  WorkLiveStatusRuntimeStatus,
} from "@/lib/dmm/work-live-status/types";
export {
  getConfiguredWorkLiveStatusBackend,
  getWorkLiveStatusRuntimeStatus,
  isWorkLiveStatusEnabled,
  isSupabaseLiveStatusConfigured,
} from "@/lib/dmm/work-live-status/types";
export { getWorkLiveStatusMetricsSummary } from "@/lib/dmm/work-live-status/metrics";
