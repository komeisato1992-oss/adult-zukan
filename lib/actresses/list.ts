import "server-only";

import { getActressSummaries, getCatalogWorks } from "@/lib/catalog";
import { getActressNamesFromItem } from "@/lib/dmm/actress-names";
import type { CatalogActressEntity } from "@/lib/dmm/catalog-entities";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";
import {
  parseActressLimitParam,
  parseActressSortParam,
  sortActresses,
  type ActressLimit,
  type ActressListItem,
  type ActressListPageData,
  type ActressSortKey,
} from "@/lib/actresses/sort";

export type { ActressListPageData };

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildPopularOrderMap(
  actresses: CatalogActressEntity[],
): Map<string, number> {
  return new Map(
    [...actresses]
      .sort(
        (a, b) =>
          b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
      )
      .map((actress, index) => [actress.name, index]),
  );
}

function buildLatestReleaseByActress(items: DmmItem[]): Map<string, number> {
  const latestReleaseByActress = new Map<string, number>();

  for (const item of filterDisplayableItems(items)) {
    const timestamp = parseReleaseTimestamp(item);

    for (const name of getActressNamesFromItem(item)) {
      const current = latestReleaseByActress.get(name) ?? 0;
      if (timestamp > current) {
        latestReleaseByActress.set(name, timestamp);
      }
    }
  }

  return latestReleaseByActress;
}

export function buildActressListItemsFromSummaries(
  summaries: CatalogActressEntity[],
  items: DmmItem[],
): ActressListItem[] {
  const popularOrderMap = buildPopularOrderMap(summaries);
  const latestReleaseByActress = buildLatestReleaseByActress(items);

  return summaries
    .filter((actress) => actress.name.trim() && actress.slug.trim())
    .map((actress) => ({
      name: actress.name,
      slug: actress.slug,
      workCount: actress.workCount,
      imageUrl: actress.imageUrl,
      reading: actress.reading,
      imageFromMultiActressWork: actress.imageFromMultiActressWork,
      latestReleaseTimestamp: latestReleaseByActress.get(actress.name) ?? 0,
      popularOrder:
        popularOrderMap.get(actress.name) ?? Number.MAX_SAFE_INTEGER,
    }));
}

export async function getActressListItems(): Promise<ActressListItem[]> {
  const [summaries, items] = await Promise.all([
    getActressSummaries(),
    getCatalogWorks(),
  ]);

  return buildActressListItemsFromSummaries(summaries, items);
}

export async function getActressListPageData(params: {
  sort?: string;
  limit?: string;
  page?: string;
  q?: string;
}): Promise<ActressListPageData> {
  const allItems = await getActressListItems();
  const sort = parseActressSortParam(params.sort);
  const limit = parseActressLimitParam(params.limit);
  const currentPage = parsePageParam(params.page);
  const q = params.q?.trim() ?? "";

  const filtered = q
    ? allItems.filter((actress) =>
        actress.name.toLowerCase().includes(q.toLowerCase()),
      )
    : allItems;
  const sorted = sortActresses(filtered, sort);
  const pagination = paginateItems(sorted, currentPage, limit);

  return {
    pageItems: pagination.items,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    sort,
    limit,
    q,
  };
}
