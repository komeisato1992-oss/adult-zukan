import "server-only";

import { encodeActressSlug } from "@/lib/actresses/slug";
import { iterateItemActresses } from "@/lib/dmm/actress-names";
import { buildActressRepresentativeImageMap } from "@/lib/dmm/actress-representative-image";
import {
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { isWorkOnSale } from "@/lib/dmm/work-sale-info";
import { getPopularityScoreBreakdown } from "@/lib/works/popularity";
import { getValidImageUrl, isValidImageUrl } from "@/lib/works";
import { slugify } from "@/lib/utils";

const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
const POPULAR_RANK_THRESHOLD = 500;

export type EntityRankingType = "actress" | "maker" | "series";

export type EntityRankingScoreBreakdown = {
  workCount: number;
  workPopularityScoreSum: number;
  popularWorkCount: number;
  recentNewCount: number;
  saleWorkCount: number;
  finalScore: number;
};

export type RankedActressEntity = {
  entityType: "actress";
  id: string;
  name: string;
  slug: string;
  workCount: number;
  imageUrl?: string;
  imageFromMultiActressWork?: boolean;
  href: string;
  score: number;
  breakdown: EntityRankingScoreBreakdown;
};

export type RankedMakerEntity = {
  entityType: "maker";
  id: string;
  name: string;
  slug: string;
  workCount: number;
  imageUrl?: string;
  href: string;
  score: number;
  breakdown: EntityRankingScoreBreakdown;
};

export type RankedSeriesEntity = {
  entityType: "series";
  id: string;
  name: string;
  slug: string;
  workCount: number;
  imageUrl?: string;
  href: string;
  score: number;
  breakdown: EntityRankingScoreBreakdown;
};

export type EntityRankingResult<T> = {
  items: T[];
  generatedAt: string;
  fromCache: boolean;
  durationMs: number;
  totalCandidates: number;
};

type AggregateBucket = {
  name: string;
  slug: string;
  works: DmmItem[];
};

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isRecentNew(item: DmmItem, now: number): boolean {
  const ts = parseReleaseTimestamp(item);
  return ts > 0 && now - ts <= MS_90_DAYS;
}

/** FANZA順位・レビューを正規化した作品人気ポイント（合計しやすいスケール） */
export function getWorkPopularityPoints(item: DmmItem): number {
  const breakdown = getPopularityScoreBreakdown(item);
  if (breakdown.source === "rank" && breakdown.sourcePopularityRank != null) {
    return Math.max(0, 2_000 - breakdown.sourcePopularityRank);
  }
  if (breakdown.source === "review") {
    return Math.min(500, Math.round(breakdown.popularityScore));
  }
  return 0;
}

function isPopularWork(item: DmmItem): boolean {
  const breakdown = getPopularityScoreBreakdown(item);
  return (
    breakdown.source === "rank" &&
    breakdown.sourcePopularityRank != null &&
    breakdown.sourcePopularityRank <= POPULAR_RANK_THRESHOLD
  );
}

function packageImage(item: DmmItem | undefined): string | undefined {
  if (!item) return undefined;
  const url = getValidImageUrl(item, ["large", "list"]);
  return isValidImageUrl(url) ? url ?? undefined : undefined;
}

function pickTopWorkByPopularity(works: DmmItem[]): DmmItem | undefined {
  if (works.length === 0) return undefined;
  return [...works].sort((a, b) => {
    const pa = getWorkPopularityPoints(a);
    const pb = getWorkPopularityPoints(b);
    if (pa !== pb) return pb - pa;
    return parseReleaseTimestamp(b) - parseReleaseTimestamp(a);
  })[0];
}

function buildBreakdown(
  works: DmmItem[],
  now: number,
  scoreFormula: (input: {
    workCount: number;
    workPopularityScoreSum: number;
    popularWorkCount: number;
    recentNewCount: number;
  }) => number,
): EntityRankingScoreBreakdown {
  let workPopularityScoreSum = 0;
  let popularWorkCount = 0;
  let recentNewCount = 0;
  let saleWorkCount = 0;

  for (const work of works) {
    workPopularityScoreSum += getWorkPopularityPoints(work);
    if (isPopularWork(work)) popularWorkCount += 1;
    if (isRecentNew(work, now)) recentNewCount += 1;
    if (isWorkOnSale(work)) saleWorkCount += 1;
  }

  const workCount = works.length;
  const finalScore = scoreFormula({
    workCount,
    workPopularityScoreSum,
    popularWorkCount,
    recentNewCount,
  });

  return {
    workCount,
    workPopularityScoreSum,
    popularWorkCount,
    recentNewCount,
    saleWorkCount,
    finalScore,
  };
}

function compareEntities(
  a: { score: number; workCount: number; name: string },
  b: { score: number; workCount: number; name: string },
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.workCount !== b.workCount) return b.workCount - a.workCount;
  return a.name.localeCompare(b.name, "ja");
}

function actressScore(input: {
  workCount: number;
  workPopularityScoreSum: number;
  popularWorkCount: number;
  recentNewCount: number;
}): number {
  return (
    input.workCount * 10 +
    input.workPopularityScoreSum +
    input.popularWorkCount * 50 +
    input.recentNewCount * 5
  );
}

function makerScore(input: {
  workCount: number;
  workPopularityScoreSum: number;
  popularWorkCount: number;
  recentNewCount: number;
}): number {
  return (
    input.workCount * 5 +
    input.workPopularityScoreSum +
    input.popularWorkCount * 20 +
    input.recentNewCount * 3
  );
}

function seriesScore(input: {
  workCount: number;
  workPopularityScoreSum: number;
  popularWorkCount: number;
  recentNewCount: number;
}): number {
  return (
    input.workCount * 7 +
    input.workPopularityScoreSum +
    input.popularWorkCount * 15 +
    input.recentNewCount * 3
  );
}

export function computePopularActresses(
  items: DmmItem[],
  limit = 30,
): RankedActressEntity[] {
  const now = Date.now();
  const displayable = items.filter(isValidDmmListItem);
  const buckets = new Map<string, AggregateBucket>();

  for (const item of displayable) {
    for (const actress of iterateItemActresses(item)) {
      const name = actress.name?.trim();
      if (!name) continue;
      const slug = encodeActressSlug(name);
      const existing = buckets.get(name);
      if (existing) {
        existing.works.push(item);
      } else {
        buckets.set(name, { name, slug, works: [item] });
      }
    }
  }

  const actressesForImages = [...buckets.values()]
    .filter((bucket) => bucket.works.length >= 1)
    .map((bucket) => ({
      name: bucket.name,
      slug: bucket.slug,
      workCount: bucket.works.length,
    }));

  const imageByActress = buildActressRepresentativeImageMap(
    displayable,
    actressesForImages,
  );

  const ranked: RankedActressEntity[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.works.length < 1) continue;
    const breakdown = buildBreakdown(bucket.works, now, actressScore);
    const image = imageByActress.get(bucket.name);
    const fallbackImage = packageImage(pickTopWorkByPopularity(bucket.works));

    ranked.push({
      entityType: "actress",
      id: bucket.slug,
      name: bucket.name,
      slug: bucket.slug,
      workCount: breakdown.workCount,
      imageUrl: image?.imageUrl ?? fallbackImage,
      imageFromMultiActressWork: image?.isFromMultiActressWork,
      href: `/actresses/${bucket.slug}`,
      score: breakdown.finalScore,
      breakdown,
    });
  }

  ranked.sort(compareEntities);
  return ranked.slice(0, Math.max(0, limit));
}

export function computePopularMakers(
  items: DmmItem[],
  limit = 30,
): RankedMakerEntity[] {
  const now = Date.now();
  const displayable = items.filter(isValidDmmListItem);
  const buckets = new Map<string, AggregateBucket>();

  for (const item of displayable) {
    const name = getDmmItemMakerName(item)?.trim();
    if (!name) continue;
    const slug = slugify(name);
    const existing = buckets.get(slug);
    if (existing) {
      existing.works.push(item);
    } else {
      buckets.set(slug, { name, slug, works: [item] });
    }
  }

  const ranked: RankedMakerEntity[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.works.length < 1) continue;
    const breakdown = buildBreakdown(bucket.works, now, makerScore);
    ranked.push({
      entityType: "maker",
      id: bucket.slug,
      name: bucket.name,
      slug: bucket.slug,
      workCount: breakdown.workCount,
      imageUrl: packageImage(pickTopWorkByPopularity(bucket.works)),
      href: `/makers/${bucket.slug}`,
      score: breakdown.finalScore,
      breakdown,
    });
  }

  ranked.sort(compareEntities);
  return ranked.slice(0, Math.max(0, limit));
}

export function computePopularSeries(
  items: DmmItem[],
  limit = 30,
): RankedSeriesEntity[] {
  const now = Date.now();
  const displayable = items.filter(isValidDmmListItem);
  const buckets = new Map<string, AggregateBucket>();

  for (const item of displayable) {
    const name = getDmmItemSeriesName(item)?.trim();
    if (!name) continue;
    const slug = slugify(name);
    const existing = buckets.get(slug);
    if (existing) {
      existing.works.push(item);
    } else {
      buckets.set(slug, { name, slug, works: [item] });
    }
  }

  const ranked: RankedSeriesEntity[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.works.length < 1) continue;
    const breakdown = buildBreakdown(bucket.works, now, seriesScore);
    ranked.push({
      entityType: "series",
      id: bucket.slug,
      name: bucket.name,
      slug: bucket.slug,
      workCount: breakdown.workCount,
      imageUrl: packageImage(pickTopWorkByPopularity(bucket.works)),
      href: `/series/${bucket.slug}`,
      score: breakdown.finalScore,
      breakdown,
    });
  }

  ranked.sort(compareEntities);
  return ranked.slice(0, Math.max(0, limit));
}
