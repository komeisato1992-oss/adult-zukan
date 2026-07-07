import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getCatalogWorks } from "@/lib/catalog";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import { buildSearchText } from "@/lib/search/build-text";

export type SearchIndexEntry = {
  contentId: string;
  searchText: string;
};

const loadSearchIndex = unstable_cache(
    async (): Promise<SearchIndexEntry[]> => {
      const items = await getCatalogWorks();
      return items.map((item) => ({
      contentId: item.content_id,
      searchText: buildSearchText(item),
    }));
  },
  ["catalog-search-index-v2"],
  { revalidate: DMM_WORKS_REVALIDATE },
);

export const getSearchIndex = cache(loadSearchIndex);
