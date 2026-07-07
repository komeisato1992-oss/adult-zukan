import "server-only";

import { unstable_cache } from "next/cache";
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
      logCatalogBuildStats(stats, {
        worksListCount: items.length,
      });
      return items;
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

export const getDmmStaticWorks = unstable_cache(
  fetchDmmStaticWorksUncached,
  ["dmm-static-works-v6", "1000", "rank"],
  { revalidate: DMM_WORKS_REVALIDATE },
);

export async function getDmmStaticWorkContentIds(): Promise<string[]> {
  const items = await getDmmStaticWorks();
  const contentIds = items.map((item) => item.content_id);
  console.log(`generateStaticParams件数: ${contentIds.length}`);
  return contentIds;
}
