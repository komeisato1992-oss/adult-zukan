import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  paginateItems,
  parsePageParam,
  WORKS_LIST_PAGE_SIZE,
} from "@/lib/pagination";
import { getSearchIndex } from "@/lib/search/index";
import { normalizeSearchQuery } from "@/lib/search/normalize-query";

export type CatalogSearchResults = {
  items: DmmItem[];
  query: string;
  total: number;
  currentPage: number;
  totalPages: number;
};

function trimSearchQuery(query: string): string {
  return query.trim().replace(/[\s\u3000]+/g, " ");
}

export async function searchCatalog(
  query: string,
  page = 1,
): Promise<CatalogSearchResults> {
  const trimmed = trimSearchQuery(query);
  const normalizedQuery = normalizeSearchQuery(trimmed);

  if (!normalizedQuery) {
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
    if (!entry.searchText.includes(normalizedQuery)) continue;
    const item = worksById.get(entry.contentId);
    if (item) matchedWorks.push(item);
  }

  const displayableWorks = filterDisplayableItems(matchedWorks);
  const total = displayableWorks.length;

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
    displayableWorks,
    currentPage,
    WORKS_LIST_PAGE_SIZE,
  );

  return {
    items: pagination.items,
    query: trimmed,
    total,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
  };
}
