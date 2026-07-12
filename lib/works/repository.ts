import "server-only";

import { unstable_cache } from "next/cache";
import type { Work } from "@/data/types";
import { fallbackWorks } from "@/data/works";
import { getAllActresses, getActressBySlug } from "@/data/actresses";
import { getAllMakers, getMakerBySlug } from "@/data/makers";
import { getAllSeries, getSeriesBySlug } from "@/data/series";
import { getAllLabels, getLabelBySlug } from "@/data/labels";
import { getGenreBySlug } from "@/data/genres";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { mapDmmItemsToWorks } from "@/lib/dmm/mapper";
import { slugify } from "@/lib/utils";

async function fetchWorksFromDmm(): Promise<Work[] | null> {
  if (!isDmmConfigured()) {
    return null;
  }

  try {
    const response = await fetchDmmItemList({ hits: 100, sort: "rank" });

    if (!response.result.items?.length) {
      return null;
    }

    return mapDmmItemsToWorks(response.result.items);
  } catch (error) {
    console.error("[DMM API] Failed to fetch works:", error);
    return null;
  }
}

async function searchWorksFromDmm(keyword: string): Promise<Work[] | null> {
  if (!isDmmConfigured()) {
    return null;
  }

  try {
    const response = await fetchDmmItemList({
      hits: 100,
      keyword,
      sort: "rank",
    });

    if (!response.result.items?.length) {
      return null;
    }

    return mapDmmItemsToWorks(response.result.items);
  } catch (error) {
    console.error("[DMM API] Failed to search works:", error);
    return null;
  }
}

const getCachedWorks = unstable_cache(
  async () => {
    const apiWorks = await fetchWorksFromDmm();
    return apiWorks ?? fallbackWorks;
  },
  ["works-all"],
  { revalidate: 3600 },
);

export async function getAllWorks(): Promise<Work[]> {
  return getCachedWorks();
}

export async function getWorkBySlug(slug: string): Promise<Work | undefined> {
  const works = await getAllWorks();
  return works.find((work) => work.slug === slug);
}

export async function getWorksBySlugs(slugs: string[]): Promise<Work[]> {
  const works = await getAllWorks();
  const slugSet = new Set(slugs);
  return works.filter((work) => slugSet.has(work.slug));
}

export async function getFeaturedWorks(limit = 5): Promise<Work[]> {
  return getRankedWorks(limit);
}

export async function getRankedWorks(limit = 10): Promise<Work[]> {
  const works = await getAllWorks();
  return [...works]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, limit);
}

export async function getWeeklyRankedWorks(limit = 10): Promise<Work[]> {
  const works = await getAllWorks();
  return [...works]
    .sort((a, b) => b.weeklyScore - a.weeklyScore)
    .slice(0, limit);
}

export async function getMonthlyRankedWorks(limit = 10): Promise<Work[]> {
  const works = await getAllWorks();
  return [...works]
    .sort((a, b) => b.monthlyScore - a.monthlyScore)
    .slice(0, limit);
}

export async function getLatestWorks(limit = 10): Promise<Work[]> {
  const works = await getAllWorks();
  return [...works]
    .sort(
      (a, b) =>
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime(),
    )
    .slice(0, limit);
}

export async function getPopularWorksByGenre(
  genreSlug: string,
  limit = 8,
): Promise<Work[]> {
  const works = await getWorksByGenre(genreSlug);
  return [...works]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, limit);
}

export async function getSaleWorks(): Promise<Work[]> {
  const works = await getAllWorks();
  return works.filter((work) => work.salePrice !== undefined);
}

export async function searchWorks(query: string): Promise<Work[]> {
  const normalized = query.trim();
  if (!normalized) {
    return getAllWorks();
  }

  const apiResults = await searchWorksFromDmm(normalized);
  if (apiResults?.length) {
    return apiResults;
  }

  const works = await getAllWorks();
  const lower = normalized.toLowerCase();

  return works.filter(
    (work) =>
      work.title.toLowerCase().includes(lower) ||
      work.description.toLowerCase().includes(lower) ||
      work.longDescription.toLowerCase().includes(lower) ||
      work.productCode.toLowerCase().includes(lower) ||
      work.makerName.toLowerCase().includes(lower) ||
      work.labelName.toLowerCase().includes(lower) ||
      work.seriesName.toLowerCase().includes(lower) ||
      work.actressNames.some((name) => name.toLowerCase().includes(lower)) ||
      work.genreNames.some((name) => name.toLowerCase().includes(lower)),
  );
}

export async function getWorksByMaker(makerSlug: string): Promise<Work[]> {
  const works = await getAllWorks();
  return works.filter((work) => work.makerSlug === makerSlug);
}

export async function getWorksByLabel(labelSlug: string): Promise<Work[]> {
  const works = await getAllWorks();
  return works.filter((work) => work.labelSlug === labelSlug);
}

export async function getWorksByGenre(genreSlug: string): Promise<Work[]> {
  const works = await getAllWorks();
  const genre = getGenreBySlug(genreSlug);

  return works.filter(
    (work) =>
      work.genreSlugs.includes(genreSlug) ||
      (genre !== undefined && work.genreNames.includes(genre.name)),
  );
}

export async function getWorksByActress(actressSlug: string): Promise<Work[]> {
  const works = await getAllWorks();
  const actress = getActressBySlug(actressSlug);

  return works.filter(
    (work) =>
      work.actressSlugs.includes(actressSlug) ||
      (actress !== undefined && work.actressNames.includes(actress.name)),
  );
}

export async function getWorksBySeries(seriesSlug: string): Promise<Work[]> {
  const works = await getAllWorks();
  return works.filter((work) => work.seriesSlug === seriesSlug);
}

export async function getRelatedWorks(work: Work, limit = 4): Promise<Work[]> {
  if (work.relatedWorkSlugs.length > 0) {
    const related = await getWorksBySlugs(work.relatedWorkSlugs);
    if (related.length >= limit) {
      return related.slice(0, limit);
    }
  }

  const works = await getAllWorks();
  return works
    .filter(
      (item) =>
        item.slug !== work.slug &&
        (item.seriesSlug === work.seriesSlug ||
          item.makerSlug === work.makerSlug ||
          item.genreSlugs.some((genreSlug) =>
            work.genreSlugs.includes(genreSlug),
          ) ||
          item.actressSlugs.some((actressSlug) =>
            work.actressSlugs.includes(actressSlug),
          )),
    )
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, limit);
}

export async function getRelatedActressesForWork(
  work: Work,
  limit = 4,
): Promise<ReturnType<typeof getAllActresses>> {
  const slugs = work.actressSlugs.slice(0, limit);
  return slugs
    .map((slug) => getActressBySlug(slug))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);
}

export async function getWorkSlugs(): Promise<string[]> {
  const works = await getAllWorks();
  return works.map((work) => work.slug);
}

export async function getRankedMakersWithCounts(limit = 10) {
  const { getPopularMakers } = await import(
    "@/lib/ranking/entity-ranking-service"
  );
  const result = await getPopularMakers(limit);
  return result.items.map((maker) => ({
    maker: {
      slug: maker.slug,
      name: maker.name,
      description: "",
      longDescription: "",
      labelSlugs: [] as string[],
    },
    workCount: maker.workCount,
    topScore: maker.score,
  }));
}

export async function getRankedSeriesWithCounts(limit = 10) {
  const { getPopularSeries } = await import(
    "@/lib/ranking/entity-ranking-service"
  );
  const result = await getPopularSeries(limit);
  return result.items.map((series) => ({
    series: {
      slug: series.slug,
      name: series.name,
      description: "",
      longDescription: "",
      makerSlug: "",
      makerName: "",
      genreSlugs: [] as string[],
    },
    workCount: series.workCount,
    topScore: series.score,
  }));
}

export async function getRankedLabelsWithCounts(limit = 10) {
  const works = await getAllWorks();
  const labels = getAllLabels();

  return labels
    .map((label) => ({
      label,
      workCount: works.filter((w) => w.labelSlug === label.slug).length,
      topScore: Math.max(
        ...works.filter((w) => w.labelSlug === label.slug).map((w) => w.rankingScore),
        0,
      ),
    }))
    .sort((a, b) => b.topScore - a.topScore)
    .slice(0, limit);
}

export async function getActressesForMaker(makerSlug: string) {
  const works = await getWorksByMaker(makerSlug);
  const slugSet = new Set<string>();
  for (const work of works) {
    for (const slug of work.actressSlugs) {
      slugSet.add(slug);
    }
  }
  return getAllActresses().filter((a) => slugSet.has(a.slug));
}

export async function getActressesForSeries(seriesSlug: string) {
  const works = await getWorksBySeries(seriesSlug);
  const slugSet = new Set<string>();
  for (const work of works) {
    for (const slug of work.actressSlugs) {
      slugSet.add(slug);
    }
  }
  return getAllActresses().filter((a) => slugSet.has(a.slug));
}

export async function getPopularWorksForActress(
  actressSlug: string,
  limit = 4,
): Promise<Work[]> {
  const works = await getWorksByActress(actressSlug);
  return [...works]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, limit);
}

export function getGenreSlugFromName(name: string): string {
  return slugify(name);
}

export { getMakerBySlug, getSeriesBySlug, getLabelBySlug };
