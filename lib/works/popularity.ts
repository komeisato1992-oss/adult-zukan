import type { DmmItem } from "@/lib/dmm/types";

export type PopularityScoreBreakdown = {
  hasPopularityData: boolean;
  source: "rank" | "review" | "none";
  sourcePopularityRank: number | null;
  reviewCount: number;
  reviewAverage: number;
  popularityScore: number;
};

function parseReviewAverage(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseReviewCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function hasPopularityData(item: DmmItem): boolean {
  return getPopularityScoreBreakdown(item).hasPopularityData;
}

export function getPopularityScoreBreakdown(item: DmmItem): PopularityScoreBreakdown {
  const rank =
    typeof item.sourcePopularityRank === "number" &&
    Number.isFinite(item.sourcePopularityRank) &&
    item.sourcePopularityRank > 0
      ? item.sourcePopularityRank
      : null;

  const reviewCount = parseReviewCount(item.review?.count);
  const reviewAverage = parseReviewAverage(item.review?.average);
  const reviewScore =
    reviewCount > 0 && reviewAverage > 0 ? reviewCount * reviewAverage : 0;

  if (rank != null) {
    return {
      hasPopularityData: true,
      source: "rank",
      sourcePopularityRank: rank,
      reviewCount,
      reviewAverage,
      popularityScore: 10_000_000 - rank,
    };
  }

  if (reviewScore > 0) {
    return {
      hasPopularityData: true,
      source: "review",
      sourcePopularityRank: null,
      reviewCount,
      reviewAverage,
      popularityScore: reviewScore,
    };
  }

  return {
    hasPopularityData: false,
    source: "none",
    sourcePopularityRank: null,
    reviewCount,
    reviewAverage,
    popularityScore: Number.NEGATIVE_INFINITY,
  };
}

export function getPopularityScore(item: DmmItem): number {
  return getPopularityScoreBreakdown(item).popularityScore;
}

export function comparePopularWorks(a: DmmItem, b: DmmItem): number {
  const aBreakdown = getPopularityScoreBreakdown(a);
  const bBreakdown = getPopularityScoreBreakdown(b);

  if (aBreakdown.hasPopularityData !== bBreakdown.hasPopularityData) {
    return aBreakdown.hasPopularityData ? -1 : 1;
  }

  if (aBreakdown.popularityScore !== bBreakdown.popularityScore) {
    return bBreakdown.popularityScore - aBreakdown.popularityScore;
  }

  if (
    aBreakdown.source === "rank" &&
    bBreakdown.source === "rank" &&
    aBreakdown.sourcePopularityRank != null &&
    bBreakdown.sourcePopularityRank != null &&
    aBreakdown.sourcePopularityRank !== bBreakdown.sourcePopularityRank
  ) {
    return aBreakdown.sourcePopularityRank - bBreakdown.sourcePopularityRank;
  }

  return 0;
}
