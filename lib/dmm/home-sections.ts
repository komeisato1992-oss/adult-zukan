import "server-only";

import {
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { encodeActressSlug } from "@/lib/actresses/slug";
import { parseDmmPrice, slugify } from "@/lib/utils";
import { parseWorkSortParam, sortWorks } from "@/lib/works/sort";
import { getValidImageUrl, hasValidImage, isValidImageUrl } from "@/lib/works";

export const HOME_SECTION_LIMIT = 8;

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
};

function isDmmItemOnSale(item: DmmItem): boolean {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
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
  return filterDisplayableItems(items).slice(0, limit);
}

export function getNewWorks(
  items: DmmItem[],
  limit = HOME_SECTION_LIMIT,
): DmmItem[] {
  return [...filterDisplayableItems(items)]
    .sort((a, b) => parseReleaseTimestamp(b) - parseReleaseTimestamp(a))
    .slice(0, limit);
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
  const counts = new Map<string, number>();

  for (const item of filterDisplayableItems(items)) {
    const name = getDmmItemMakerName(item);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
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

export function getRankedSeries(
  items: DmmItem[],
  limit = 8,
): RankedNameCount[] {
  const counts = new Map<string, number>();

  for (const item of filterDisplayableItems(items)) {
    const name = getDmmItemSeriesName(item);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
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
  const map = new Map<string, { count: number; imageUrl?: string }>();

  for (const item of filterDisplayableItems(items)) {
    const actresses = item.actress ?? item.iteminfo?.actress ?? [];
    const imageUrl = getValidImageUrl(item, ["large", "list"]);

    for (const actress of actresses) {
      if (!actress.name) continue;

      const existing = map.get(actress.name);
      const nextImageUrl =
        existing?.imageUrl ??
        (isValidImageUrl(imageUrl) ? imageUrl : undefined);

      map.set(actress.name, {
        count: (existing?.count ?? 0) + 1,
        imageUrl: nextImageUrl,
      });
    }
  }

  return [...map.entries()]
    .map(([name, { count, imageUrl }]) => ({
      name,
      slug: encodeActressSlug(name),
      workCount: count,
      imageUrl,
    }))
    .filter((actress) => actress.workCount >= 1)
    .sort(
      (a, b) =>
        b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
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
