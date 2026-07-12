import "server-only";

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
import { getDmmStaticWorks } from "@/lib/dmm/static-works";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { shouldShowUnavailableDetailPage } from "@/lib/dmm/catalog-visibility";
import type { DmmItem } from "@/lib/dmm/types";
import { buildCatalogOrderMap } from "@/lib/works/sort";
import { RELATED_WORKS_DISPLAY_LIMIT } from "@/lib/pagination";

/** リクエスト内で1回だけ構築する catalog 追加順マップ（index 0 = 最近追加） */
export const getCatalogOrderMap = cache(async (): Promise<Map<string, number>> => {
  const works = await getCatalogWorks();
  return buildCatalogOrderMap(works);
});

/** リクエスト内で1回だけ読み込むカタログ作品一覧 */
export const getCatalogWorks = cache(async (): Promise<DmmItem[]> => {
  return getDmmStaticWorks();
});

function createSummariesLoader<T>(
  compute: (items: DmmItem[]) => T,
): () => Promise<T> {
  return cache(async (): Promise<T> => {
    const items = await getCatalogWorks();
    return compute(items);
  });
}

export const getActressSummaries = cache(async () => {
  const { ensureActressImageOverridesLoaded } = await import(
    "@/lib/dmm/actress-image-overrides"
  );
  await ensureActressImageOverridesLoaded();
  const items = await getCatalogWorks();
  return getCatalogActresses(items);
});

export const getMakerSummaries = createSummariesLoader(getCatalogMakers);

export const getSeriesSummaries = createSummariesLoader(getCatalogSeries);

export const getGenreSummaries = createSummariesLoader(getCatalogGenres);

export const getLabelSummaries = createSummariesLoader(getCatalogLabels);

export const getCatalogWorkByContentId = cache(
  async (contentId: string): Promise<DmmItem | null> => {
    const works = await getCatalogWorks();
    return works.find((entry) => entry.content_id === contentId) ?? null;
  },
);

/** 非公開作品を含むカタログから作品を取得（販売終了詳細ページ用） */
export const getCatalogWorkRawByContentId = cache(
  async (contentId: string): Promise<DmmItem | null> => {
    const snapshot = readCatalogSnapshot();
    const item = snapshot.find((entry) => entry.content_id === contentId);
    if (!item || !filterValidCatalogItems([item]).length) {
      return null;
    }
    return item;
  },
);

export async function getUnavailableCatalogWorkByContentId(
  contentId: string,
): Promise<DmmItem | null> {
  const raw = await getCatalogWorkRawByContentId(contentId);
  if (!raw || !shouldShowUnavailableDetailPage(raw)) {
    return null;
  }
  return raw;
}

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
  const { ensureActressImageOverridesLoaded } = await import(
    "@/lib/dmm/actress-image-overrides"
  );
  await ensureActressImageOverridesLoaded();
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
