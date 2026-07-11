import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  paginateItems,
  parsePageParam,
  WORKS_LIST_PAGE_SIZE,
} from "@/lib/pagination";
import { mapPageItemsToWorkCards } from "@/lib/works/paginated-work-list";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item";
import {
  buildCatalogOrderMap,
  parseWorkSortParam,
  sortWorks,
  type WorkSortKey,
} from "@/lib/works/sort";
import { getSearchIndex } from "@/lib/search/index";
import {
  normalizeSearchInput,
  searchEntryMatches,
} from "@/lib/search/match";

export type CatalogSearchResults = {
  items: WorkListCardItem[];
  query: string;
  total: number;
  currentPage: number;
  totalPages: number;
};

export async function searchCatalogAll(query: string): Promise<{
  items: DmmItem[];
  query: string;
}> {
  const { trimmed, normalized } = normalizeSearchInput(query);

  if (!normalized) {
    return { items: [], query: "" };
  }

  const index = await getSearchIndex();
  const works = await getCatalogWorks();
  const worksById = new Map(works.map((item) => [item.content_id, item]));

  const matchedWorks: DmmItem[] = [];
  for (const entry of index) {
    if (!searchEntryMatches(entry, normalized)) continue;
    const item = worksById.get(entry.contentId);
    if (item) matchedWorks.push(item);
  }

  return {
    items: filterDisplayableItems(matchedWorks),
    query: trimmed,
  };
}

export async function searchCatalog(
  query: string,
  page = 1,
  sort: WorkSortKey = parseWorkSortParam(null),
): Promise<CatalogSearchResults> {
  const { trimmed, normalized } = normalizeSearchInput(query);

  if (!normalized) {
    return {
      items: [],
      query: "",
      total: 0,
      currentPage: 1,
      totalPages: 1,
    };
  }

  const index = await getSearchIndex();
  const works = await getCatalogWorks();
  const worksById = new Map(works.map((item) => [item.content_id, item]));

  const matchedWorks: DmmItem[] = [];
  for (const entry of index) {
    if (!searchEntryMatches(entry, normalized)) continue;
    const item = worksById.get(entry.contentId);
    if (item) matchedWorks.push(item);
  }

  const displayableWorks = filterDisplayableItems(matchedWorks);
  const catalogOrder = buildCatalogOrderMap(works);
  const sortedWorks = sortWorks(displayableWorks, sort, { catalogOrder });
  const total = sortedWorks.length;

  if (total === 0) {
    return {
      items: [],
      query: trimmed,
      total: 0,
      currentPage: 1,
      totalPages: 1,
    };
  }

  const currentPage = parsePageParam(page);
  const pagination = paginateItems(
    sortedWorks,
    currentPage,
    WORKS_LIST_PAGE_SIZE,
  );

  return {
    items: mapPageItemsToWorkCards(pagination.items),
    query: trimmed,
    total,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
  };
}
