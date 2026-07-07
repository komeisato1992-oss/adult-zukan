import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  filterValidCatalogItems,
  getCatalogActresses,
  getCatalogActressBySlug,
  getCatalogGenres,
  getCatalogLabels,
  getCatalogMakers,
  getCatalogSeries,
  getCatalogWorksByActressSlug,
  getCatalogWorksByGenreSlug,
  getCatalogWorksByLabelSlug,
  getCatalogWorksByMakerSlug,
  getCatalogWorksBySeriesSlug,
} from "@/lib/dmm/catalog-entities";
import {
  getDmmItemActressNameList,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import { getDmmStaticWorks } from "@/lib/dmm/static-works";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { RELATED_WORKS_DISPLAY_LIMIT } from "@/lib/pagination";

/** リクエスト内で1回だけ読み込むカタログ作品一覧 */
export const getCatalogWorks = cache(async (): Promise<DmmItem[]> => {
  return getDmmStaticWorks();
});

function createSummariesLoader<T>(
  cacheKey: string,
  compute: (items: DmmItem[]) => T,
): () => Promise<T> {
  const loadSummaries = unstable_cache(
    async () => {
      const items = await getCatalogWorks();
      return compute(items);
    },
    [cacheKey],
    { revalidate: DMM_WORKS_REVALIDATE },
  );

  return cache(loadSummaries);
}

export const getActressSummaries = createSummariesLoader(
  "catalog-actress-summaries-v1",
  getCatalogActresses,
);

export const getMakerSummaries = createSummariesLoader(
  "catalog-maker-summaries-v1",
  getCatalogMakers,
);

export const getSeriesSummaries = createSummariesLoader(
  "catalog-series-summaries-v1",
  getCatalogSeries,
);

export const getGenreSummaries = createSummariesLoader(
  "catalog-genre-summaries-v1",
  getCatalogGenres,
);

export const getLabelSummaries = createSummariesLoader(
  "catalog-label-summaries-v1",
  getCatalogLabels,
);

export const getCatalogWorkByContentId = cache(
  async (contentId: string): Promise<DmmItem | null> => {
    const snapshot = readCatalogSnapshot();
    const item = snapshot.find((entry) => entry.content_id === contentId);
    if (!item) return null;
    const [valid] = filterValidCatalogItems([item]);
    return valid ?? null;
  },
);

export const getActressWorksBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogWorksByActressSlug(items, slug);
});

export const getMakerWorksBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogWorksByMakerSlug(items, slug);
});

export const getLabelWorksBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogWorksByLabelSlug(items, slug);
});

export const getSeriesWorksBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogWorksBySeriesSlug(items, slug);
});

export const getGenreWorksBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogWorksByGenreSlug(items, slug);
});

export const getActressSummaryBySlug = cache(async (slug: string) => {
  const items = await getCatalogWorks();
  return getCatalogActressBySlug(items, slug);
});

export const getMakerSummaryBySlug = cache(async (slug: string) => {
  const makers = await getMakerSummaries();
  return makers.find((maker) => maker.slug === slug);
});

export const getGenreSummaryBySlug = cache(async (slug: string) => {
  const genres = await getGenreSummaries();
  return genres.find((genre) => genre.slug === slug);
});

export const getSeriesSummaryBySlug = cache(async (slug: string) => {
  const series = await getSeriesSummaries();
  return series.find((entry) => entry.slug === slug);
});

export const getLabelSummaryBySlug = cache(async (slug: string) => {
  const labels = await getLabelSummaries();
  return labels.find((label) => label.slug === slug);
});

export async function getRelatedWorksFromCatalog(
  item: DmmItem,
  limit = RELATED_WORKS_DISPLAY_LIMIT,
): Promise<DmmItem[]> {
  const items = await getCatalogWorks();
  const actressName = getDmmItemActressNameList(item)[0];
  const makerName = getDmmItemMakerName(item);
  const order = new Map(items.map((work, index) => [work.content_id, index]));

  const related = items.filter((work) => {
    if (work.content_id === item.content_id) return false;

    if (
      actressName &&
      getDmmItemActressNameList(work).some((name) => name === actressName)
    ) {
      return true;
    }

    return Boolean(makerName && getDmmItemMakerName(work) === makerName);
  });

  related.sort(
    (a, b) =>
      (order.get(a.content_id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.content_id) ?? Number.MAX_SAFE_INTEGER),
  );

  return related.slice(0, limit);
}
