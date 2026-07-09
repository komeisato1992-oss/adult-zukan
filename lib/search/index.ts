import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getCatalogWorks } from "@/lib/catalog";
import { getCatalogSnapshotFingerprint } from "@/lib/dmm/catalog-display";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import { buildSearchFieldValues } from "@/lib/search/build-text";

export type SearchIndexEntry = {
  contentId: string;
  /** 正規化済み title / actress / maker / label / series / genre 等 */
  searchFields: string[];
};

const SEARCH_INDEX_REVALIDATE = DMM_WORKS_REVALIDATE;

async function buildSearchIndexEntries(): Promise<SearchIndexEntry[]> {
  const items = await getCatalogWorks();
  return items.map((item) => ({
    contentId: item.content_id,
    searchFields: buildSearchFieldValues(item),
  }));
}

function loadSearchIndexCached(fingerprint: string): Promise<SearchIndexEntry[]> {
  return unstable_cache(
    buildSearchIndexEntries,
    ["catalog-search-index-v5", fingerprint],
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
