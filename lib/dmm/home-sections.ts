import "server-only";

import {
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  computePopularActresses,
  computePopularMakers,
  computePopularSeries,
} from "@/lib/ranking/entity-ranking";
import { parseDmmPrice, slugify } from "@/lib/utils";
import { isWorkOnSale } from "@/lib/dmm/work-sale-info";
import { parseWorkSortParam, sortWorks } from "@/lib/works/sort";
import { hasValidImage } from "@/lib/works";

export const HOME_SECTION_LIMIT = 6;
export const HERO_CAROUSEL_LIMIT = 5;

export type RankedNameCount = {
  name: string;
  slug: string;
  workCount: number;
};

export type RankedActress = {
  name: string;
  slug: string;
  workCount: number;
  imageUrl?: string;
  imageFromMultiActressWork?: boolean;
};

function isDmmItemOnSale(item: DmmItem): boolean {
  return isWorkOnSale(item);
}

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function filterDisplayableItems(items: DmmItem[]): DmmItem[] {
  return items.filter(isValidDmmListItem);
}

/** TOP・作品一覧で共有するカタログ作品リスト */
export async function getSharedCatalogWorks(): Promise<DmmItem[]> {
  const { ensureActressImageOverridesLoaded } = await import(
    "@/lib/dmm/actress-image-overrides"
  );
  await ensureActressImageOverridesLoaded();
  const { getCatalogWorks } = await import("@/lib/catalog");
  return getCatalogWorks();
}

export function getHeroWorks(items: DmmItem[], limit = 1): DmmItem[] {
  return filterDisplayableItems(items)
    .filter((item) => {
      const hasImage = hasValidImage(item);
      const hasTitle = Boolean(item.title?.trim());
      const hasPrice = parseDmmPrice(item.prices?.price) > 0;
      const hasFanzaLink = Boolean(
        item.affiliateURL?.trim() || item.URL?.trim(),
      );
      return hasImage && hasTitle && hasPrice && hasFanzaLink;
    })
    .slice(0, limit);
}

export function getPopularWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return sortWorks(filterDisplayableItems(items), "popular").slice(0, limit);
}

export function getNewWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return sortWorks(filterDisplayableItems(items), "release-desc").slice(0, limit);
}

export function getSaleWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return filterDisplayableItems(items)
    .filter(isDmmItemOnSale)
    .slice(0, limit);
}

export function getWeeklyRankingWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return getPopularWorks(items, limit);
}

export function getMonthlyRankingWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return [...filterDisplayableItems(items)].reverse().slice(0, limit);
}

export function getRankedMakers(
  items: DmmItem[],
  limit = 8,
): RankedNameCount[] {
  return computePopularMakers(items, limit).map((maker) => ({
    name: maker.name,
    slug: maker.slug,
    workCount: maker.workCount,
  }));
}

export function getRankedSeries(
  items: DmmItem[],
  limit = 8,
): RankedNameCount[] {
  return computePopularSeries(items, limit).map((series) => ({
    name: series.name,
    slug: series.slug,
    workCount: series.workCount,
  }));
}

export function getRankedGenres(
  items: DmmItem[],
  limit = 8,
): RankedNameCount[] {
  const counts = new Map<string, number>();

  for (const item of filterDisplayableItems(items)) {
    const genres = item.iteminfo?.genre ?? [];
    for (const genre of genres) {
      if (!genre.name) continue;
      counts.set(genre.name, (counts.get(genre.name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, workCount]) => ({
      name,
      slug: slugify(name),
      workCount,
    }))
    .sort(
      (a, b) =>
        b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
}

export function getRankedActresses(
  items: DmmItem[],
  limit = 10,
): RankedActress[] {
  return computePopularActresses(items, limit).map((actress) => ({
    name: actress.name,
    slug: actress.slug,
    workCount: actress.workCount,
    imageUrl: actress.imageUrl,
    imageFromMultiActressWork: actress.imageFromMultiActressWork,
  }));
}

export function filterCatalogWorks(
  items: DmmItem[],
  params: { q?: string; sale?: boolean; sort?: string },
): DmmItem[] {
  let filtered = filterDisplayableItems(items);

  const keyword = params.q?.trim().toLowerCase();
  if (keyword) {
    filtered = filtered.filter((item) => {
      const actresses = item.actress ?? item.iteminfo?.actress ?? [];
      const actressText = actresses.map((a) => a.name).join(" ");
      const maker = getDmmItemMakerName(item) ?? "";
      const haystack =
        `${item.title} ${item.content_id} ${maker} ${actressText}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }

  if (params.sale) {
    filtered = filtered.filter(isDmmItemOnSale);
  }

  return sortWorks(filtered, parseWorkSortParam(params.sort));
}
