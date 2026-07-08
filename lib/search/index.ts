import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getCatalogWorks } from "@/lib/catalog";
import { getCatalogSnapshotFingerprint } from "@/lib/dmm/catalog-display";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import { buildSearchText } from "@/lib/search/build-text";

export type SearchIndexEntry = {
  contentId: string;
  searchText: string;
};

const SEARCH_INDEX_REVALIDATE = DMM_WORKS_REVALIDATE;

async function buildSearchIndexEntries(): Promise<SearchIndexEntry[]> {
  const items = await getCatalogWorks();
  return items.map((item) => ({
    contentId: item.content_id,
    searchText: buildSearchText(item),
  }));
}

function loadSearchIndexCached(fingerprint: string): Promise<SearchIndexEntry[]> {
  return unstable_cache(
    buildSearchIndexEntries,
    ["catalog-search-index-v3", fingerprint],
    { revalidate: SEARCH_INDEX_REVALIDATE },
  )();
}

export const getSearchIndex = cache(async (): Promise<SearchIndexEntry[]> => {
  if (process.env.NODE_ENV === "development") {
    return buildSearchIndexEntries();
  }

  const fingerprint = getCatalogSnapshotFingerprint();
  return loadSearchIndexCached(fingerprint);
});
