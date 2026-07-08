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

export async function getAdminSiteStats(): Promise<AdminSiteStats> {
  const [
    works,
    actresses,
    makers,
    labels,
    series,
    genres,
    snapshot,
  ] = await Promise.all([
    getCatalogWorks(),
    getActressSummaries(),
    getMakerSummaries(),
    getLabelSummaries(),
    getSeriesSummaries(),
    getGenreSummaries(),
    Promise.resolve(readCatalogSnapshot()),
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
    works: works.length,
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
