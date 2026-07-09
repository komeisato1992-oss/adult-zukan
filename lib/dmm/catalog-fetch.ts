import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import {
  analyzeCatalogItems,
  pickValidCatalogItems,
  type CatalogFilterStats,
} from "@/lib/dmm/catalog-filter-stats";
import type { DmmItem } from "@/lib/dmm/types";

export const CATALOG_MIN_VALID = 300;
export const CATALOG_MAX_API_ITEMS = 10000;
export const DMM_CATALOG_SORT = "rank" as const;
const FETCH_BATCH_SIZE = 100;
const MAX_OFFSET = 5001;

export type CatalogFetchResult = {
  items: DmmItem[];
  stats: CatalogFilterStats;
};

export async function fetchDmmCatalogFromApi(): Promise<CatalogFetchResult> {
  if (!isDmmConfigured()) {
    return {
      items: [],
      stats: {
        apiTotal: 0,
        excluded: 0,
        validCount: 0,
        noImage: 0,
        nowPrinting: 0,
        noContentId: 0,
        noTitle: 0,
        other: 0,
      },
    };
  }

  const raw: DmmItem[] = [];
  const seen = new Set<string>();
  let apiTotal = 0;

  for (
    let offset = 1;
    offset <= MAX_OFFSET && raw.length < CATALOG_MAX_API_ITEMS;
    offset += FETCH_BATCH_SIZE
  ) {
    let data;

    try {
      data = await fetchDmmItemList({
        hits: FETCH_BATCH_SIZE,
        offset,
        sort: DMM_CATALOG_SORT,
        cache: "no-store",
      });
    } catch {
      break;
    }

    const pageItems = data.result.items ?? [];
    if (pageItems.length === 0) break;

    apiTotal += pageItems.length;

    for (const item of pageItems) {
      if (!item.content_id || seen.has(item.content_id)) continue;
      seen.add(item.content_id);
      raw.push(item);
    }

    if (pageItems.length < FETCH_BATCH_SIZE) {
      break;
    }
  }

  const items = pickValidCatalogItems(raw);
  const stats = analyzeCatalogItems(raw);
  stats.apiTotal = apiTotal;
  stats.validCount = items.length;
  stats.excluded = raw.length - items.length;

  return { items, stats };
}
