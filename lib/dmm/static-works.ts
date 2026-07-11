import "server-only";

import { cache } from "react";
import { analyzeCatalogItems } from "@/lib/dmm/catalog-filter-stats";
import { logCatalogBuildStats } from "@/lib/dmm/catalog-build-log";
import {
  CATALOG_MIN_VALID,
  DMM_CATALOG_SORT,
  fetchDmmCatalogFromApi,
} from "@/lib/dmm/catalog-fetch";
import { filterValidCatalogItems } from "@/lib/dmm/catalog-entities";
import { dedupeWorksForDisplay } from "@/lib/dmm/catalog-dedupe";
import {
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from "@/lib/dmm/catalog-snapshot";
import { isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";

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

async function fetchDmmStaticWorksUncached(): Promise<DmmItem[]> {
  if (cachedValidWorks) {
    return cachedValidWorks;
  }

  const snapshot = readCatalogSnapshot();

  if (snapshot.length >= CATALOG_MIN_VALID) {
    const items = dedupeWorksForDisplay(filterValidCatalogItems(snapshot));
    const stats = analyzeCatalogItems(snapshot);
    stats.validCount = items.length;
    logBuildStatsOnce(stats, { worksListCount: items.length });
    cachedValidWorks = items;
    return items;
  }

  if (isDmmConfigured()) {
    const { items, stats } = await fetchDmmCatalogFromApi();

    if (items.length > 0) {
      writeCatalogSnapshot(items);
      const validItems = dedupeWorksForDisplay(filterValidCatalogItems(items));
      stats.validCount = validItems.length;
      logBuildStatsOnce(stats, {
        worksListCount: validItems.length,
      });
      cachedValidWorks = validItems;
      return validItems;
    }
  }

  if (snapshot.length > 0) {
    const items = dedupeWorksForDisplay(filterValidCatalogItems(snapshot));
    const stats = analyzeCatalogItems(snapshot);
    stats.validCount = items.length;
    logBuildStatsOnce(stats, { worksListCount: items.length });
    cachedValidWorks = items;
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
  return [];
}

/** 834件超の配列は unstable_cache 2MB 制限を超えるため React cache のみ使用 */
export const getDmmStaticWorks = cache(fetchDmmStaticWorksUncached);

export async function getDmmStaticWorkContentIds(): Promise<string[]> {
  const items = await getDmmStaticWorks();
  return items.map((item) => item.content_id);
}
