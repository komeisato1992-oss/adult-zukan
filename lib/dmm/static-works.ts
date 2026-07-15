import "server-only";

import { cache } from "react";
import { existsSync, statSync } from "fs";
import path from "path";
import { analyzeCatalogItems } from "@/lib/dmm/catalog-filter-stats";
import { logCatalogBuildStats } from "@/lib/dmm/catalog-build-log";
import {
  CATALOG_MIN_VALID,
  DMM_CATALOG_SORT,
  fetchDmmCatalogFromApi,
} from "@/lib/dmm/catalog-fetch";
import { filterPublicCatalogWorks } from "@/lib/dmm/catalog-visibility";
import { filterValidCatalogItems } from "@/lib/dmm/catalog-entities";
import { dedupeWorksForDisplay } from "@/lib/dmm/catalog-dedupe";
import {
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from "@/lib/dmm/catalog-snapshot";
import { CATALOG_MANIFEST_RELATIVE } from "@/lib/dmm/catalog-shards";
import {
  getAdultPublicCatalogTtlSec,
  isAdultCatalogCacheEnabled,
} from "@/lib/dmm/cost-flags";
import { getAdultPublicCatalogMemoryHolder } from "@/lib/dmm/public-catalog-cache";
import { isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";
import { incrPerfCounter } from "@/lib/perf/measure";

/** DMM作品ページのISR再検証間隔（24時間） */
export const DMM_WORKS_REVALIDATE = 86400;

export { DMM_CATALOG_SORT };

let cachedValidWorks: DmmItem[] | null = null;
let loggedCatalogBuildStats = false;

function logBuildStatsOnce(
  stats: Parameters<typeof logCatalogBuildStats>[0],
  extra?: Parameters<typeof logCatalogBuildStats>[1],
): void {
  if (loggedCatalogBuildStats) return;
  logCatalogBuildStats(stats, extra);
  loggedCatalogBuildStats = true;
}

function getManifestMtimeMs(): number {
  const manifestPath = path.join(process.cwd(), CATALOG_MANIFEST_RELATIVE);
  if (!existsSync(manifestPath)) return 0;
  try {
    return statSync(manifestPath).mtimeMs;
  } catch {
    return 0;
  }
}

async function getCatalogCacheStampMs(): Promise<number> {
  const manifestMs = getManifestMtimeMs();
  try {
    const { getConfiguredWorksMasterBackend } = await import(
      "@/lib/dmm/works-master/types"
    );
    const { getLocalWorksMasterMtimeMs } = await import(
      "@/lib/dmm/works-master/local-store"
    );
    const backend = getConfiguredWorksMasterBackend();
    if (backend === "local") {
      return Math.max(manifestMs, getLocalWorksMasterMtimeMs());
    }
  } catch {
    // works-master optional during bootstrap
  }
  return manifestMs;
}

async function readFromProcessCache(): Promise<DmmItem[] | null> {
  if (!isAdultCatalogCacheEnabled()) return null;
  const holder = getAdultPublicCatalogMemoryHolder();
  if (!holder.cache) return null;
  const ttlMs = getAdultPublicCatalogTtlSec() * 1000;
  const mtimeMs = await getCatalogCacheStampMs();
  if (mtimeMs !== holder.mtimeMs) return null;
  if (Date.now() - holder.loadedAt > ttlMs) return null;
  incrPerfCounter("adult.public.catalog.hit");
  return holder.cache as DmmItem[];
}

async function writeProcessCache(items: DmmItem[]): Promise<void> {
  if (!isAdultCatalogCacheEnabled()) return;
  const holder = getAdultPublicCatalogMemoryHolder();
  holder.cache = items;
  holder.mtimeMs = await getCatalogCacheStampMs();
  holder.loadedAt = Date.now();
  incrPerfCounter("adult.public.catalog.store");
}

/** JSON スナップショットへ works マスター（公開分）をマージ。同一 CID は DB 優先 */
async function mergeWorksMasterPreferringDb(snapshot: DmmItem[]): Promise<DmmItem[]> {
  try {
    const {
      fetchPublishedWorksMasterAsDmmItems,
      mergeWorksMasterIntoCatalog,
      getConfiguredWorksMasterBackend,
    } = await import("@/lib/dmm/works-master");
    if (getConfiguredWorksMasterBackend() === "off") return snapshot;
    const masterItems = await fetchPublishedWorksMasterAsDmmItems();
    if (masterItems.length === 0) return snapshot;
    return mergeWorksMasterIntoCatalog(snapshot, masterItems);
  } catch (error) {
    console.warn("[static-works] works-master merge skipped", error);
    return snapshot;
  }
}

async function fetchDmmStaticWorksUncached(): Promise<DmmItem[]> {
  const fromMem = await readFromProcessCache();
  if (fromMem) {
    return fromMem;
  }

  if (cachedValidWorks) {
    await writeProcessCache(cachedValidWorks);
    return cachedValidWorks;
  }

  incrPerfCounter("adult.public.catalog.miss");
  const snapshot = await mergeWorksMasterPreferringDb(readCatalogSnapshot());
  const { mergeLightOverlayIntoItems } = await import(
    "@/lib/admin/fanza-light-overlay-store"
  );
  const snapshotWithOverlay = await mergeLightOverlayIntoItems(snapshot);

  if (snapshotWithOverlay.length >= CATALOG_MIN_VALID) {
    const items = dedupeWorksForDisplay(
      filterPublicCatalogWorks(filterValidCatalogItems(snapshotWithOverlay)),
    );
    const stats = analyzeCatalogItems(snapshotWithOverlay);
    stats.validCount = items.length;
    logBuildStatsOnce(stats, { worksListCount: items.length });
    cachedValidWorks = items;
    await writeProcessCache(items);
    return items;
  }

  if (isDmmConfigured()) {
    const { items, stats } = await fetchDmmCatalogFromApi();

    if (items.length > 0) {
      writeCatalogSnapshot(items);
      const mergedApi = await mergeWorksMasterPreferringDb(items);
      const validItems = dedupeWorksForDisplay(
        filterPublicCatalogWorks(filterValidCatalogItems(mergedApi)),
      );
      stats.validCount = validItems.length;
      logBuildStatsOnce(stats, {
        worksListCount: validItems.length,
      });
      cachedValidWorks = validItems;
      await writeProcessCache(validItems);
      return validItems;
    }
  }

  if (snapshotWithOverlay.length > 0) {
    const items = dedupeWorksForDisplay(
      filterPublicCatalogWorks(filterValidCatalogItems(snapshotWithOverlay)),
    );
    const stats = analyzeCatalogItems(snapshotWithOverlay);
    stats.validCount = items.length;
    logBuildStatsOnce(stats, { worksListCount: items.length });
    cachedValidWorks = items;
    await writeProcessCache(items);
    return items;
  }

  logBuildStatsOnce({
    apiTotal: 0,
    excluded: 0,
    validCount: 0,
    noImage: 0,
    nowPrinting: 0,
    noContentId: 0,
    noTitle: 0,
    other: 0,
  });

  cachedValidWorks = [];
  await writeProcessCache([]);
  return [];
}

/** 軽量同期オーバーレイ適用後に呼ぶ（プロセス内キャッシュ破棄） */
export function invalidateDmmStaticWorksCache(): void {
  cachedValidWorks = null;
  const holder = getAdultPublicCatalogMemoryHolder();
  holder.cache = null;
  holder.loadedAt = 0;
  holder.mtimeMs = -1;
}

/** 834件超の配列は unstable_cache 2MB 制限を超えるため React cache + プロセスTTL */
export const getDmmStaticWorks = cache(fetchDmmStaticWorksUncached);

export async function getDmmStaticWorkContentIds(): Promise<string[]> {
  const items = await getDmmStaticWorks();
  return items.map((item) => item.content_id);
}
