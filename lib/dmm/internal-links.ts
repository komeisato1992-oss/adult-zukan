import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import {
  getDmmItemActressNameList,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import {
  getNewWorks,
  getPopularWorks,
} from "@/lib/dmm/home-sections";
import type { DmmItem } from "@/lib/dmm/types";
import { matchesActressSlug } from "@/lib/actresses/slug";
import { slugify } from "@/lib/utils";
import { RELATED_WORKS_DISPLAY_LIMIT } from "@/lib/pagination";

export type DmmInternalLinkSection = {
  id: string;
  title: string;
  items: DmmItem[];
};

const SECTION_LIMIT = RELATED_WORKS_DISPLAY_LIMIT;

function excludeCurrent(
  items: DmmItem[],
  contentId: string,
  limit = SECTION_LIMIT,
): DmmItem[] {
  return items.filter((item) => item.content_id !== contentId).slice(0, limit);
}

function filterByActress(
  catalog: DmmItem[],
  actressName: string,
  contentId: string,
): DmmItem[] {
  return excludeCurrent(
    catalog.filter((work) =>
      getDmmItemActressNameList(work).includes(actressName),
    ),
    contentId,
  );
}

function filterByMaker(
  catalog: DmmItem[],
  makerName: string,
  contentId: string,
): DmmItem[] {
  return excludeCurrent(
    catalog.filter((work) => getDmmItemMakerName(work) === makerName),
    contentId,
  );
}

function filterBySeries(
  catalog: DmmItem[],
  seriesName: string,
  contentId: string,
): DmmItem[] {
  return excludeCurrent(
    catalog.filter((work) => getDmmItemSeriesName(work) === seriesName),
    contentId,
  );
}

function filterByGenre(
  catalog: DmmItem[],
  genreSlug: string,
  contentId: string,
): DmmItem[] {
  return excludeCurrent(
    catalog.filter((work) =>
      (work.iteminfo?.genre ?? []).some(
        (genre) => genre.name && slugify(genre.name) === genreSlug,
      ),
    ),
    contentId,
  );
}

export async function getDmmWorkInternalLinks(
  item: DmmItem,
): Promise<DmmInternalLinkSection[]> {
  const catalog = filterDisplayableItems(await getCatalogWorks());
  const contentId = item.content_id;
  const actressNames = getDmmItemActressNameList(item);
  const makerName = getDmmItemMakerName(item);
  const seriesName = getDmmItemSeriesName(item);
  const firstGenre = item.iteminfo?.genre?.[0];
  const sections: DmmInternalLinkSection[] = [];

  if (actressNames[0]) {
    const items = filterByActress(catalog, actressNames[0], contentId);
    if (items.length > 0) {
      sections.push({
        id: "same-actress",
        title: `${actressNames[0]}の出演作品`,
        items,
      });
    }
  }

  if (makerName) {
    const items = filterByMaker(catalog, makerName, contentId);
    if (items.length > 0) {
      sections.push({
        id: "same-maker",
        title: `${makerName}の作品`,
        items,
      });
    }
  }

  if (seriesName) {
    const items = filterBySeries(catalog, seriesName, contentId);
    if (items.length > 0) {
      sections.push({
        id: "same-series",
        title: `${seriesName}シリーズ`,
        items,
      });
    }
  }

  if (firstGenre?.name) {
    const items = filterByGenre(catalog, slugify(firstGenre.name), contentId);
    if (items.length > 0) {
      sections.push({
        id: "same-genre",
        title: `${firstGenre.name}ジャンルの作品`,
        items,
      });
    }
  }

  const popular = excludeCurrent(getPopularWorks(catalog, SECTION_LIMIT), contentId);
  if (popular.length > 0) {
    sections.push({ id: "popular", title: "人気作品", items: popular });
  }

  const newest = excludeCurrent(getNewWorks(catalog, SECTION_LIMIT), contentId);
  if (newest.length > 0) {
    sections.push({ id: "new", title: "新着作品", items: newest });
  }

  const { mergeLiveStatusIntoItems } = await import(
    "@/lib/dmm/work-live-status"
  );
  const allItems = sections.flatMap((section) => section.items);
  const liveItems = await mergeLiveStatusIntoItems(allItems);
  const liveById = new Map(liveItems.map((item) => [item.content_id, item]));

  return sections.map((section) => ({
    ...section,
    items: section.items.map(
      (item) => liveById.get(item.content_id) ?? item,
    ),
  }));
}

export async function getActressInternalLinks(slug: string): Promise<{
  popularWorks: DmmItem[];
  sameMakerWorks: DmmItem[];
}> {
  const catalog = filterDisplayableItems(await getCatalogWorks());
  const actressWorks = catalog.filter((work) =>
    getDmmItemActressNameList(work).some((name) =>
      matchesActressSlug(name, slug),
    ),
  );

  const makerCounts = new Map<string, number>();
  for (const work of actressWorks) {
    const maker = getDmmItemMakerName(work);
    if (!maker) continue;
    makerCounts.set(maker, (makerCounts.get(maker) ?? 0) + 1);
  }

  const topMaker = [...makerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const popularWorks = getPopularWorks(
    actressWorks.length > 0 ? actressWorks : catalog,
    SECTION_LIMIT,
  );
  const sameMakerWorks = topMaker
    ? filterByMaker(catalog, topMaker, "")
    : [];

  const { mergeLiveStatusIntoItems } = await import(
    "@/lib/dmm/work-live-status"
  );
  const [popularLive, sameMakerLive] = await Promise.all([
    mergeLiveStatusIntoItems(popularWorks),
    mergeLiveStatusIntoItems(sameMakerWorks),
  ]);

  return { popularWorks: popularLive, sameMakerWorks: sameMakerLive };
}

export async function getMakerInternalLinks(slug: string): Promise<{
  popularWorks: DmmItem[];
  topSeries: { name: string; slug: string; workCount: number }[];
  topActresses: { name: string; slug: string; workCount: number }[];
}> {
  const catalog = filterDisplayableItems(await getCatalogWorks());
  const makerWorks = catalog.filter(
    (work) => slugify(getDmmItemMakerName(work) ?? "") === slug,
  );

  const seriesCounts = new Map<string, { name: string; count: number }>();
  const actressCounts = new Map<string, { name: string; count: number }>();

  for (const work of makerWorks) {
    const series = getDmmItemSeriesName(work);
    if (series) {
      const key = slugify(series);
      const existing = seriesCounts.get(key);
      seriesCounts.set(key, {
        name: series,
        count: (existing?.count ?? 0) + 1,
      });
    }

    for (const actress of getDmmItemActressNameList(work)) {
      const key = slugify(actress);
      const existing = actressCounts.get(key);
      actressCounts.set(key, {
        name: actress,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  const topSeries = [...seriesCounts.entries()]
    .map(([seriesSlug, value]) => ({
      name: value.name,
      slug: seriesSlug,
      workCount: value.count,
    }))
    .sort((a, b) => b.workCount - a.workCount)
    .slice(0, 6);

  const topActresses = [...actressCounts.entries()]
    .map(([actressSlug, value]) => ({
      name: value.name,
      slug: actressSlug,
      workCount: value.count,
    }))
    .sort((a, b) => b.workCount - a.workCount)
    .slice(0, 6);

  const { mergeLiveStatusIntoItems } = await import(
    "@/lib/dmm/work-live-status"
  );
  const popularWorks = await mergeLiveStatusIntoItems(
    getPopularWorks(makerWorks, SECTION_LIMIT),
  );

  return {
    popularWorks,
    topSeries,
    topActresses,
  };
}
