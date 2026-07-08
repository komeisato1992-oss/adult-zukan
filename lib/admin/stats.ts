import "server-only";

import {
  getActressSummaries,
  getCatalogWorks,
  getGenreSummaries,
  getLabelSummaries,
  getMakerSummaries,
  getSeriesSummaries,
} from "@/lib/catalog";
import { analyzeCatalogItems } from "@/lib/dmm/catalog-filter-stats";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { getDmmItemDescription } from "@/lib/dmm/description";
import { getDmmItemActressNameList } from "@/lib/dmm/display";

export type AdminSiteStats = {
  works: number;
  actresses: number;
  makers: number;
  labels: number;
  series: number;
  genres: number;
  noImage: number;
  noActress: number;
  noDescription: number;
};

/** Dashboard・作品追加ページ共通の掲載作品数（有効作品のみ） */
export async function getPublishedWorkCount(): Promise<number> {
  const works = await getCatalogWorks();
  return works.length;
}

/** catalog-snapshot.json の生の配列件数（掲載対象外を含む） */
export function getCatalogSnapshotTotalCount(): number {
  return readCatalogSnapshot().length;
}

export async function getImportWorkCounts(): Promise<{
  publishedCount: number;
  catalogTotalCount: number;
}> {
  const [publishedCount, catalogTotalCount] = await Promise.all([
    getPublishedWorkCount(),
    Promise.resolve(getCatalogSnapshotTotalCount()),
  ]);

  return { publishedCount, catalogTotalCount };
}

export async function getAdminSiteStats(): Promise<AdminSiteStats> {
  const [
    publishedCount,
    actresses,
    makers,
    labels,
    series,
    genres,
    snapshot,
    works,
  ] = await Promise.all([
    getPublishedWorkCount(),
    getActressSummaries(),
    getMakerSummaries(),
    getLabelSummaries(),
    getSeriesSummaries(),
    getGenreSummaries(),
    Promise.resolve(readCatalogSnapshot()),
    getCatalogWorks(),
  ]);

  const filterStats = analyzeCatalogItems(snapshot);

  let noActress = 0;
  let noDescription = 0;

  for (const work of works) {
    if (getDmmItemActressNameList(work).length === 0) {
      noActress += 1;
    }
    if (!getDmmItemDescription(work)) {
      noDescription += 1;
    }
  }

  return {
    works: publishedCount,
    actresses: actresses.length,
    makers: makers.length,
    labels: labels.length,
    series: series.length,
    genres: genres.length,
    noImage: filterStats.noImage,
    noActress,
    noDescription,
  };
}
