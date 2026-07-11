import "server-only";

import { searchCatalog, searchCatalogAll, type CatalogSearchResults } from "@/lib/search/catalog";
import { parseWorkSortParam } from "@/lib/works/sort";

export type { CatalogSearchResults };

export async function unifiedSearch(
  query: string,
  page = 1,
  sort = parseWorkSortParam(null),
): Promise<CatalogSearchResults> {
  return searchCatalog(query, page, sort);
}

export async function unifiedSearchAll(query: string) {
  return searchCatalogAll(query);
}
