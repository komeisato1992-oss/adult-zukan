import "server-only";

import {
  getDmmItemGenreNameList,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getNewWorks, getPopularWorks } from "@/lib/dmm/home-sections";
import type { DmmItem } from "@/lib/dmm/types";
import { slugify } from "@/lib/utils";

export type ActressPageGenre = {
  name: string;
  slug: string;
  workCount: number;
};

export type ActressPageSeries = {
  name: string;
  slug: string;
  workCount: number;
};

export type ActressPageMaker = {
  name: string;
  workCount: number;
};

export type ActressPageSections = {
  catalogWorkCount: number;
  latestWork?: DmmItem;
  popularWorks: DmmItem[];
  genres: ActressPageGenre[];
  series: ActressPageSeries[];
  makers: ActressPageMaker[];
};

function countByName<T>(
  items: Iterable<T>,
  getNames: (item: T) => string[],
): Map<string, { name: string; count: number }> {
  const counts = new Map<string, { name: string; count: number }>();

  for (const item of items) {
    for (const name of getNames(item)) {
      const key = slugify(name);
      if (!key) continue;
      const existing = counts.get(key);
      counts.set(key, {
        name,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return counts;
}

function toRankedList(
  counts: Map<string, { name: string; count: number }>,
  minCount: number,
): { name: string; slug: string; workCount: number }[] {
  return [...counts.entries()]
    .map(([slug, value]) => ({
      name: value.name,
      slug,
      workCount: value.count,
    }))
    .filter((entry) => entry.workCount >= minCount)
    .sort(
      (a, b) =>
        b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
    );
}

export function buildActressPageSections(works: DmmItem[]): ActressPageSections {
  const displayable = filterDisplayableItems(works);

  const genreCounts = countByName(displayable, getDmmItemGenreNameList);
  const seriesCounts = countByName(displayable, (work) => {
    const name = getDmmItemSeriesName(work);
    return name ? [name] : [];
  });
  const makerCounts = countByName(displayable, (work) => {
    const name = getDmmItemMakerName(work);
    return name ? [name] : [];
  });

  return {
    catalogWorkCount: displayable.length,
    latestWork: getNewWorks(displayable, 1)[0],
    popularWorks: getPopularWorks(displayable, 6),
    genres: toRankedList(genreCounts, 2),
    series: toRankedList(seriesCounts, 3),
    makers: [...makerCounts.values()]
      .map((value) => ({
        name: value.name,
        workCount: value.count,
      }))
      .sort(
        (a, b) =>
          b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
      ),
  };
}
