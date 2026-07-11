import "server-only";

import {
  getDmmItemActressNameList,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { slugify } from "@/lib/utils";

export type ImportSeoPopularityContext = {
  actressWorkCounts: Map<string, number>;
  makerWorkCounts: Map<string, number>;
  seriesWorkCounts: Map<string, number>;
  popularMakerNames: Set<string>;
  popularSeriesNames: Set<string>;
};

const POPULAR_MAKER_MIN_WORKS = 8;
const POPULAR_SERIES_MIN_WORKS = 4;

function incrementCount(map: Map<string, number>, key: string): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function buildImportSeoPopularityContext(): Promise<ImportSeoPopularityContext> {
  const items = readCatalogSnapshot();
  const actressWorkCounts = new Map<string, number>();
  const makerWorkCounts = new Map<string, number>();
  const seriesWorkCounts = new Map<string, number>();

  for (const item of items) {
    for (const actress of getDmmItemActressNameList(item)) {
      incrementCount(actressWorkCounts, actress.trim());
    }

    const maker = getDmmItemMakerName(item)?.trim();
    if (maker) incrementCount(makerWorkCounts, maker);

    const series = getDmmItemSeriesName(item)?.trim();
    if (series) incrementCount(seriesWorkCounts, series);
  }

  const popularMakerNames = new Set<string>();
  for (const [name, count] of makerWorkCounts) {
    if (count >= POPULAR_MAKER_MIN_WORKS) {
      popularMakerNames.add(name);
    }
  }

  const popularSeriesNames = new Set<string>();
  for (const [name, count] of seriesWorkCounts) {
    if (count >= POPULAR_SERIES_MIN_WORKS) {
      popularSeriesNames.add(name);
    }
  }

  return {
    actressWorkCounts,
    makerWorkCounts,
    seriesWorkCounts,
    popularMakerNames,
    popularSeriesNames,
  };
}

export function getActressCatalogWorkCount(
  context: ImportSeoPopularityContext,
  actressName: string,
): number {
  return context.actressWorkCounts.get(actressName.trim()) ?? 0;
}

export function isPopularMakerName(
  context: ImportSeoPopularityContext,
  makerName: string | undefined,
): boolean {
  const trimmed = makerName?.trim();
  if (!trimmed) return false;
  return context.popularMakerNames.has(trimmed);
}

export function isPopularSeriesName(
  context: ImportSeoPopularityContext,
  seriesName: string | undefined,
): boolean {
  const trimmed = seriesName?.trim();
  if (!trimmed) return false;
  return context.popularSeriesNames.has(trimmed);
}

export function getMakerCatalogWorkCount(
  context: ImportSeoPopularityContext,
  makerName: string | undefined,
): number {
  const trimmed = makerName?.trim();
  if (!trimmed) return 0;
  return context.makerWorkCounts.get(trimmed) ?? 0;
}

export function getSeriesCatalogWorkCount(
  context: ImportSeoPopularityContext,
  seriesName: string | undefined,
): number {
  const trimmed = seriesName?.trim();
  if (!trimmed) return 0;
  return context.seriesWorkCounts.get(trimmed) ?? 0;
}

export function slugKey(name: string): string {
  return slugify(name.trim());
}
