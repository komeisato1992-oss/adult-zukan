import "server-only";

import { searchCatalog, type CatalogSearchResults } from "@/lib/search/catalog";

export type { CatalogSearchResults };

export async function unifiedSearch(
  query: string,
  page = 1,
): Promise<CatalogSearchResults> {
  return searchCatalog(query, page);
}
