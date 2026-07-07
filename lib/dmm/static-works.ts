import "server-only";

import { cache } from "react";
import { analyzeCatalogItems } from "@/lib/dmm/catalog-filter-stats";
import { logCatalogBuildStats } from "@/lib/dmm/catalog-build-log";
import {
  CATALOG_MIN_VALID,
  CATALOG_TARGET_VALID,
  DMM_CATALOG_SORT,
  fetchDmmCatalogFromApi,
} from "@/lib/dmm/catalog-fetch";
import { filterValidCatalogItems } from "@/lib/dmm/catalog-entities";
import {
  readCatalogSnapshot,
  writeCatalogSnapshot,
} from "@/lib/dmm/catalog-snapshot";
import { isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";

/** DMM作品ページのISR再検証間隔（24時間） */
export const DMM_WORKS_REVALIDATE = 86400;

export const DMM_STATIC_WORKS_COUNT = CATALOG_TARGET_VALID;

export { DMM_CATALOG_SORT };

async function fetchDmmStaticWorksUncached(): Promise<DmmItem[]> {
  const snapshot = readCatalogSnapshot();

  if (snapshot.length >= CATALOG_MIN_VALID) {
    const items = filterValidCatalogItems(
      snapshot.slice(0, DMM_STATIC_WORKS_COUNT),
    );
    const stats = analyzeCatalogItems(snapshot);
    stats.validCount = items.length;
    logCatalogBuildStats(stats, { worksListCount: items.length });
    return items;
  }

  if (isDmmConfigured()) {
    const { items, stats } = await fetchDmmCatalogFromApi();

    if (items.length > 0) {
      writeCatalogSnapshot(items);
      const validItems = filterValidCatalogItems(
        items.slice(0, DMM_STATIC_WORKS_COUNT),
      );
      stats.validCount = validItems.length;
      logCatalogBuildStats(stats, {
        worksListCount: validItems.length,
      });
      return validItems;
    }
  }

  if (snapshot.length > 0) {
    const items = filterValidCatalogItems(
      snapshot.slice(0, DMM_STATIC_WORKS_COUNT),
    );
    const stats = analyzeCatalogItems(snapshot);
    stats.validCount = items.length;
    logCatalogBuildStats(stats, { worksListCount: items.length });
    return items;
  }

  logCatalogBuildStats({
    apiTotal: 0,
    excluded: 0,
    validCount: 0,
    noImage: 0,
    nowPrinting: 0,
    noContentId: 0,
    noTitle: 0,
    other: 0,
  });

  return [];
}

/** 834件超の配列は unstable_cache 2MB 制限を超えるため React cache のみ使用 */
export const getDmmStaticWorks = cache(fetchDmmStaticWorksUncached);

export async function getDmmStaticWorkContentIds(): Promise<string[]> {
  const items = await getDmmStaticWorks();
  const contentIds = items.map((item) => item.content_id);
  console.log(`generateStaticParams件数: ${contentIds.length}`);
  return contentIds;
}
