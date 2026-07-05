import catalog from "./catalog/index";
import type { Series } from "./types";

export const seriesList: Series[] = catalog.series;

export function getAllSeries(): Series[] {
  return seriesList;
}

export function getSeriesBySlug(slug: string): Series | undefined {
  return seriesList.find((series) => series.slug === slug);
}

export function getRankedSeries(limit = 10): Series[] {
  return [...seriesList].slice(0, limit);
}

export function getSeriesByMaker(makerSlug: string): Series[] {
  return seriesList.filter((series) => series.makerSlug === makerSlug);
}
