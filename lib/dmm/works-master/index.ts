import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import {
  dmmItemToWorkMasterRow,
  mergeSyncMasterRowIntoDmmItem,
  workMasterRowToDmmItem,
} from "@/lib/dmm/works-master/map";
import {
  getLocalWorksMasterMtimeMs,
  invalidateLocalWorksMasterCache,
  localCountWorkMasterRows,
  localFetchAllPublishedWorkMasters,
  localFetchAllWorkMasterCids,
  localFetchWorkMasterByCids,
  localUpsertWorkMasterRows,
} from "@/lib/dmm/works-master/local-store";
import {
  getWorksMasterMetricsSummary,
  recordWorksMasterWrite,
} from "@/lib/dmm/works-master/metrics";
import {
  supabaseCountWorkMasterRowsDetailed,
  supabaseFetchAllPublishedWorkMasters,
  supabaseFetchAllPublishedWorkMasterCids,
  supabaseFetchAllWorkMasterCids,
  supabaseFetchWorkMasterByCids,
  supabaseFetchWorkMastersForSyncByCids,
  supabaseFetchWorkMastersUpdatedSince,
  supabaseFetchExistingCidsByCids,
  supabaseCountWorkMasterRows,
  supabaseUpsertWorkMasterRows,
} from "@/lib/dmm/works-master/supabase-store";
import {
  getConfiguredWorksMasterBackend,
  getWorksMasterRevalidateSec,
  isWorksMasterSupabaseConfigured,
  type WorksMasterBackend,
  type WorkMasterRow,
  type WorkMasterUpsertInput,
} from "@/lib/dmm/works-master/types";
import {
  detectAdultImageStatusMany,
  hasDisplayableAdultImage,
  isAdultImageStatusOk,
} from "@/lib/works/image-status";
import { pickPackageImageCandidate } from "@/lib/works/package-image";

export const WORKS_MASTER_CACHE_TAG = "works-master";

export type WorksMasterStorageInfo = {
  backend: WorksMasterBackend;
  label: string;
  rowCount: number | null;
  countStatus: "ok" | "connection_error" | "table_missing" | "fetch_failed";
  countMessage: string | null;
  deployRequired: false;
  supabaseConfigured: boolean;
  metrics: ReturnType<typeof getWorksMasterMetricsSummary>;
};

export type WorksMasterUpsertResult = {
  upserted: number;
  backend: WorksMasterBackend;
  published: boolean;
  usedJsonFallback: boolean;
  supabaseSavedCount: number;
  jsonFallbackCount: number;
  error: string | null;
};

export function getWorksMasterStorageLabel(
  backend: WorksMasterBackend = getConfiguredWorksMasterBackend(),
): string {
  if (backend === "supabase") return "Supabase";
  if (backend === "local") {
    return isWorksMasterSupabaseConfigured()
      ? "ローカルJSON（Supabase障害時フォールバック）"
      : "ローカルDBファイル（Supabase未設定時）";
  }
  return "既存JSON（フォールバック）";
}

function filterRowsWithValidPackageImage(
  rows: WorkMasterRow[],
): WorkMasterRow[] {
  return rows.filter((row) =>
    hasDisplayableAdultImage({
      imageStatus: row.image_status,
      packageImage: row.package_image,
    }),
  );
}

async function fetchPublishedRowsUncached(): Promise<WorkMasterRow[]> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return [];

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return filterRowsWithValidPackageImage(
        await supabaseFetchAllPublishedWorkMasters(),
      );
    } catch (error) {
      console.warn(
        "[works-master] supabase published fetch failed; falling back to local JSON",
        error,
      );
      try {
        return filterRowsWithValidPackageImage(
          await localFetchAllPublishedWorkMasters(),
        );
      } catch {
        return [];
      }
    }
  }

  try {
    return filterRowsWithValidPackageImage(
      await localFetchAllPublishedWorkMasters(),
    );
  } catch (error) {
    console.warn("[works-master] local published fetch failed", error);
    return [];
  }
}

/** 公開作品マスターを DmmItem 配列で取得（tagged cache） */
export async function fetchPublishedWorksMasterAsDmmItems(): Promise<DmmItem[]> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return [];

  const revalidateSec = getWorksMasterRevalidateSec();
  const localStamp =
    backend === "local" && !isWorksMasterSupabaseConfigured()
      ? String(getLocalWorksMasterMtimeMs())
      : "remote";

  try {
    const cachedFn = unstable_cache(
      async () => {
        const rows = await fetchPublishedRowsUncached();
        return rows.map(workMasterRowToDmmItem);
      },
      ["works-master-published", backend, localStamp],
      { revalidate: revalidateSec, tags: [WORKS_MASTER_CACHE_TAG] },
    );
    return await cachedFn();
  } catch {
    const rows = await fetchPublishedRowsUncached();
    return rows.map(workMasterRowToDmmItem);
  }
}

/** JSON カタログへマスターをマージ（同一 CID はマスター優先） */
export function mergeWorksMasterIntoCatalog(
  jsonItems: DmmItem[],
  masterItems: DmmItem[],
): DmmItem[] {
  if (masterItems.length === 0) return jsonItems;

  const byCid = new Map<string, DmmItem>();
  for (const item of jsonItems) {
    const cid = normalizeCatalogContentId(item.content_id);
    if (!cid) continue;
    byCid.set(cid, item);
  }
  for (const item of masterItems) {
    const cid = normalizeCatalogContentId(item.content_id);
    if (!cid) continue;
    byCid.set(cid, item);
  }
  return [...byCid.values()];
}

export async function fetchWorkMasterByCids(
  cids: string[],
): Promise<Map<string, WorkMasterRow>> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off" || cids.length === 0) return new Map();

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return await supabaseFetchWorkMasterByCids(cids);
    } catch (error) {
      console.warn(
        "[works-master] supabase fetch by cid failed; falling back to local JSON",
        error,
      );
      return await localFetchWorkMasterByCids(cids);
    }
  }

  try {
    return await localFetchWorkMasterByCids(cids);
  } catch (error) {
    console.warn("[works-master] fetch by cid failed", error);
    return new Map();
  }
}

/**
 * 候補 CID が works に既にあるか（cid 列のみ・.in 照合）。
 * 全件取得はしない。
 */
export async function fetchExistingWorkMasterCids(
  cids: string[],
): Promise<Set<string>> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off" || cids.length === 0) return new Set();

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return await supabaseFetchExistingCidsByCids(cids);
    } catch (error) {
      console.warn(
        "[works-master] existing cid lookup failed; falling back to local",
        error,
      );
      const local = await localFetchWorkMasterByCids(cids);
      return new Set(local.keys());
    }
  }

  try {
    const local = await localFetchWorkMasterByCids(cids);
    return new Set(local.keys());
  } catch {
    return new Set();
  }
}

/** works テーブルの件数のみ（行データなし） */
export async function countWorkMasterRows(): Promise<number | null> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return null;

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return await supabaseCountWorkMasterRows();
    } catch (error) {
      console.warn("[works-master] count failed", error);
      try {
        return await localCountWorkMasterRows();
      } catch {
        return null;
      }
    }
  }

  try {
    return await localCountWorkMasterRows();
  } catch {
    return null;
  }
}

/** FANZA 同期バッチ用: 必要列のみ */
export async function fetchWorkMastersForSyncByCids(
  cids: string[],
): Promise<Map<string, WorkMasterRow>> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off" || cids.length === 0) return new Map();

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return await supabaseFetchWorkMastersForSyncByCids(cids);
    } catch (error) {
      console.warn(
        "[works-master] supabase sync fetch by cid failed; falling back to local",
        error,
      );
      return await localFetchWorkMasterByCids(cids);
    }
  }

  try {
    return await localFetchWorkMasterByCids(cids);
  } catch (error) {
    console.warn("[works-master] sync fetch by cid failed", error);
    return new Map();
  }
}

/**
 * updated_at 差分でマスターを取得（同期用）。
 * sinceIso 未設定時は空（全件 select は行わない）。
 */
export async function fetchWorkMastersUpdatedSince(
  sinceIso: string | null | undefined,
  options?: { publishedOnly?: boolean; maxRows?: number },
): Promise<WorkMasterRow[]> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return [];

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return await supabaseFetchWorkMastersUpdatedSince(sinceIso, options);
    } catch (error) {
      console.warn(
        "[works-master] supabase updated_since fetch failed",
        error,
      );
      return [];
    }
  }

  // local: updated_at フィルタで差分相当
  const sinceMs = sinceIso?.trim() ? Date.parse(sinceIso) : NaN;
  if (!Number.isFinite(sinceMs)) return [];
  try {
    const rows = await localFetchAllPublishedWorkMasters();
    return rows.filter((row) => {
      const ts = Date.parse(row.updated_at);
      return Number.isFinite(ts) && ts > sinceMs;
    });
  } catch {
    return [];
  }
}

/** 同期バッチの DmmItem を works マスター（狭い列）で上書きマージ */
export async function enrichDmmItemsForSync(
  items: DmmItem[],
): Promise<DmmItem[]> {
  if (items.length === 0) return items;
  const cids = items.map((item) => item.content_id);
  const masterMap = await fetchWorkMastersForSyncByCids(cids);
  if (masterMap.size === 0) return items;

  return items.map((item) => {
    const cid = normalizeCatalogContentId(item.content_id);
    const row = cid ? masterMap.get(cid) : undefined;
    if (!row) return item;
    return mergeSyncMasterRowIntoDmmItem(item, row);
  });
}

export async function getWorksMasterContentIdSet(): Promise<Set<string>> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return new Set();

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return new Set(await supabaseFetchAllWorkMasterCids());
    } catch (error) {
      console.warn(
        "[works-master] supabase cid set failed; falling back to local JSON",
        error,
      );
      return new Set(await localFetchAllWorkMasterCids());
    }
  }

  try {
    return new Set(await localFetchAllWorkMasterCids());
  } catch (error) {
    console.warn("[works-master] cid set failed", error);
    return new Set();
  }
}

/** 公開対象 works の CID のみ */
export async function getPublishedWorksMasterContentIdSet(): Promise<Set<string>> {
  const backend = getConfiguredWorksMasterBackend();
  if (backend === "off") return new Set();

  if (backend === "supabase" || isWorksMasterSupabaseConfigured()) {
    try {
      return new Set(await supabaseFetchAllPublishedWorkMasterCids());
    } catch (error) {
      console.warn(
        "[works-master] supabase published cid set failed; falling back",
        error,
      );
    }
  }

  try {
    const rows = await localFetchAllPublishedWorkMasters();
    return new Set(
      rows
        .map((row) => normalizeCatalogContentId(row.cid))
        .filter((cid): cid is string => Boolean(cid)),
    );
  } catch (error) {
    console.warn("[works-master] published cid set failed", error);
    return new Set();
  }
}

export type WorksMasterPrecheckedImage = {
  status: "ok" | "now_printing" | "fetch_failed";
  checkedAt: string;
  packageImage?: string | null;
};

/**
 * 作品マスターへ保存。
 * Supabase 接続時は必ず works へ UPSERT。障害時のみローカル JSON へフォールバック。
 *
 * precheckedByCid があれば画像 GET しない（候補取得時の判定を再利用）。
 * image_status が ok 以外の作品は保存するが初期 published=false。
 */
export async function upsertWorksMasterFromDmmItems(
  works: DmmItem[],
  options?: {
    published?: boolean;
    precheckedByCid?: Record<string, WorksMasterPrecheckedImage>;
  },
): Promise<WorksMasterUpsertResult> {
  const configuredBackend = getConfiguredWorksMasterBackend();
  const published = options?.published ?? true;
  if (configuredBackend === "off") {
    return {
      upserted: 0,
      backend: "off",
      published,
      usedJsonFallback: false,
      supabaseSavedCount: 0,
      jsonFallbackCount: 0,
      error: null,
    };
  }

  const now = new Date().toISOString();
  const { computeWorksPublished } = await import(
    "@/lib/admin/works-cms-publish"
  );
  const prechecked = options?.precheckedByCid ?? {};

  // 追加時: 事前判定があればそれを使い、未設定のみ URL→必要時 GET
  // （通常閲覧・検索・公開管理では再判定しない）
  const draftRows = works
    .map((work) => {
      const row = dmmItemToWorkMasterRow(work, {
        published: options?.published ?? true,
        now,
      });
      if (!row) return null;
      const pre = prechecked[row.cid];
      if (pre?.packageImage !== undefined) {
        row.package_image = pre.packageImage;
      }
      // URLなしでも手動追加（非公開）を許可するため、prechecked があれば通す
      if (!pickPackageImageCandidate(work) && !row.package_image && !pre) {
        return null;
      }
      return { work, row };
    })
    .filter((entry): entry is { work: DmmItem; row: WorkMasterUpsertInput } =>
      Boolean(entry),
    );

  const needDetectIndexes: number[] = [];
  const needDetectUrls: Array<string | null> = [];
  for (let i = 0; i < draftRows.length; i += 1) {
    const cid = draftRows[i].row.cid;
    if (prechecked[cid]?.status) continue;
    needDetectIndexes.push(i);
    needDetectUrls.push(
      pickPackageImageCandidate(draftRows[i].work) ??
        draftRows[i].row.package_image,
    );
  }

  const detectedFresh =
    needDetectUrls.length > 0
      ? await detectAdultImageStatusMany(needDetectUrls, 3)
      : [];
  const detectedByDraftIndex = new Map<
    number,
    (typeof detectedFresh)[number]
  >();
  needDetectIndexes.forEach((draftIndex, j) => {
    detectedByDraftIndex.set(draftIndex, detectedFresh[j]);
  });

  const rows = draftRows
    .map((entry, index) => {
      const row = entry.row;
      const pre = prechecked[row.cid];
      if (pre?.status) {
        row.image_status = pre.status;
        row.image_status_checked_at = pre.checkedAt;
      } else {
        const detected = detectedByDraftIndex.get(index);
        if (!detected) return null;
        row.image_status = detected.status;
        row.image_status_checked_at = detected.checkedAt;
      }

      // ok 以外は安全のため非公開（手動選択の NOW PRINTING / 取得失敗を含む）
      if (!isAdultImageStatusOk(row.image_status)) {
        row.published = false;
        return row;
      }

      if (options?.published !== false) {
        row.published = computeWorksPublished({
          packageImage: row.package_image,
          imageStatus: row.image_status,
          isAvailable:
            entry.work.isActive !== false &&
            entry.work.availabilityStatus !== "unavailable",
          manualHidden: entry.work.hiddenReason === "manual",
        });
      }
      if (
        row.published &&
        !hasDisplayableAdultImage({
          imageStatus: row.image_status,
          packageImage: row.package_image,
        })
      ) {
        row.published = false;
      }
      return row;
    })
    .filter((row): row is WorkMasterUpsertInput => Boolean(row));

  if (rows.length === 0) {
    return {
      upserted: 0,
      backend: configuredBackend,
      published,
      usedJsonFallback: false,
      supabaseSavedCount: 0,
      jsonFallbackCount: 0,
      error: null,
    };
  }

  const preferSupabase =
    configuredBackend === "supabase" || isWorksMasterSupabaseConfigured();

  if (preferSupabase) {
    try {
      const { upserted } = await supabaseUpsertWorkMasterRows(rows);
      const count = upserted || rows.length;
      recordWorksMasterWrite({
        backend: "supabase",
        upserted: count,
        usedJsonFallback: false,
      });
      return {
        upserted: count,
        backend: "supabase",
        published,
        usedJsonFallback: false,
        supabaseSavedCount: count,
        jsonFallbackCount: 0,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        "[works-master] supabase upsert failed; falling back to local JSON",
        message,
      );
      const { upserted } = await localUpsertWorkMasterRows(rows);
      const count = upserted || rows.length;
      recordWorksMasterWrite({
        backend: "local",
        upserted: count,
        usedJsonFallback: true,
        error: message,
      });
      return {
        upserted: count,
        backend: "local",
        published,
        usedJsonFallback: true,
        supabaseSavedCount: 0,
        jsonFallbackCount: count,
        error: message,
      };
    }
  }

  const { upserted } = await localUpsertWorkMasterRows(rows);
  const count = upserted || rows.length;
  recordWorksMasterWrite({
    backend: "local",
    upserted: count,
    usedJsonFallback: false,
  });
  return {
    upserted: count,
    backend: "local",
    published,
    usedJsonFallback: false,
    supabaseSavedCount: 0,
    jsonFallbackCount: 0,
    error: null,
  };
}

/** 作品追加完了後のみ呼ぶ（ページ全体 revalidate 禁止） */
export async function revalidateWorksMasterAfterAdd(): Promise<void> {
  invalidateLocalWorksMasterCache();
  try {
    revalidateTag(WORKS_MASTER_CACHE_TAG);
    revalidateTag("public-works-list");
    revalidateTag("public-work-filter-options");
    revalidateTag("public-entity-summaries");
    revalidateTag("actress-list");
  } catch {
    // build / non-Next context
  }
  const { invalidateDmmStaticWorksCache } = await import("@/lib/dmm/static-works");
  invalidateDmmStaticWorksCache();
}

export async function getWorksMasterStorageInfo(): Promise<WorksMasterStorageInfo> {
  const backend = getConfiguredWorksMasterBackend();
  const supabaseConfigured = isWorksMasterSupabaseConfigured();
  let rowCount: number | null = null;
  let countStatus: WorksMasterStorageInfo["countStatus"] = "ok";
  let countMessage: string | null = null;

  try {
    if (backend === "supabase" || supabaseConfigured) {
      const detailed = await supabaseCountWorkMasterRowsDetailed();
      if (detailed.status === "ok") {
        rowCount = detailed.count;
        countStatus = "ok";
      } else {
        try {
          rowCount = await localCountWorkMasterRows();
          countStatus = "ok";
          countMessage = `${detailed.message ?? "取得失敗"}（ローカル件数を表示）`;
        } catch {
          rowCount = null;
          countStatus = detailed.status;
          countMessage = detailed.message;
        }
      }
    } else if (backend === "local") {
      rowCount = await localCountWorkMasterRows();
      countStatus = "ok";
    } else {
      rowCount = null;
      countStatus = "fetch_failed";
      countMessage = "作品マスターが無効です";
    }
  } catch {
    rowCount = null;
    countStatus = "fetch_failed";
    countMessage = "取得失敗";
  }

  return {
    backend,
    label: getWorksMasterStorageLabel(backend),
    rowCount,
    countStatus,
    countMessage,
    deployRequired: false,
    supabaseConfigured,
    metrics: getWorksMasterMetricsSummary(),
  };
}

export {
  dmmItemToWorkMasterRow,
  mergeSyncMasterRowIntoDmmItem,
  workMasterRowToDmmItem,
} from "@/lib/dmm/works-master/map";
export type {
  WorksMasterBackend,
  WorkMasterRow,
} from "@/lib/dmm/works-master/types";
export {
  getConfiguredWorksMasterBackend,
  isWorksMasterEnabled,
  isWorksMasterSupabaseConfigured,
} from "@/lib/dmm/works-master/types";
export { getWorksMasterMetricsSummary } from "@/lib/dmm/works-master/metrics";
export {
  WORK_MASTER_DETAIL_SELECT,
  WORK_MASTER_SYNC_SELECT,
} from "@/lib/dmm/works-master/supabase-store";
