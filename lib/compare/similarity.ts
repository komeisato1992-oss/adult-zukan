import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { getCurrentPrice, getRegularPrice } from "@/lib/dmm/sale-price";
import type { DmmItem } from "@/lib/dmm/types";
import { getPopularityScore } from "@/lib/works/popularity";

export type SimilaritySort =
  | "overall"
  | "genre"
  | "actress"
  | "price";

export const SIMILARITY_SORTS: readonly SimilaritySort[] = [
  "overall",
  "genre",
  "actress",
  "price",
] as const;

export const SIMILARITY_SORT_LABELS: Record<SimilaritySort, string> = {
  overall: "総合的に似ている",
  genre: "シーン・ジャンルが似ている",
  actress: "出演女優が共通",
  price: "価格が近い",
};

export const COMPARE_SELECT_PAGE_SIZE = 10;
export const COMPARE_SELECT_MAX_CANDIDATES = 100;
export const COMPARE_SELECT_MAX_PAGES = 10;

/** 両作品に似ている判定の最低類似度（100点満点） */
export const BOTH_SIMILAR_MIN_SCORE = 60;

export type SimilarityReason = {
  key: string;
  label: string;
};

export type SimilarityBreakdown = {
  series: number;
  actress: number;
  genre: number;
  makerOrLabel: number;
  price: number;
  releaseDate: number;
  popularity: number;
};

export type SimilarityResult = {
  score: number;
  breakdown: SimilarityBreakdown;
  reasons: SimilarityReason[];
  genreJaccard: number;
  sharedActressCount: number;
  sharedActressRatio: number;
  priceDiffRatio: number | null;
  priceDiffYen: number | null;
  sameSeries: boolean;
  sameMaker: boolean;
  sameLabel: boolean;
  sameMainActress: boolean;
};

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, value);
}

function toTime(value?: string): number | null {
  if (!value?.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function jaccard(a: string[], b: string[]): {
  intersection: number;
  union: number;
  ratio: number;
} {
  if (a.length === 0 && b.length === 0) {
    return { intersection: 0, union: 0, ratio: 0 };
  }
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const value of setB) {
    if (setA.has(value)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return {
    intersection,
    union,
    ratio: union > 0 ? intersection / union : 0,
  };
}

/** ジャンル類似度（0〜1、Jaccard） */
export function calculateGenreSimilarity(
  anchor: DmmItem,
  candidate: DmmItem,
): number {
  const anchorGenres = getDmmItemGenreNameList(anchor);
  const candidateGenres = getDmmItemGenreNameList(candidate);
  return jaccard(anchorGenres, candidateGenres).ratio;
}

/** 出演女優類似度（0〜100） */
export function calculateActressSimilarity(
  anchor: DmmItem,
  candidate: DmmItem,
): number {
  const anchorActresses = getDmmItemActressNameList(anchor);
  const candidateActresses = getDmmItemActressNameList(candidate);
  if (anchorActresses.length === 0 || candidateActresses.length === 0) {
    return 0;
  }

  const shared = jaccard(anchorActresses, candidateActresses);
  if (shared.intersection === 0) return 0;

  const mainMatch =
    Boolean(anchorActresses[0]) &&
    Boolean(candidateActresses[0]) &&
    anchorActresses[0] === candidateActresses[0];

  let score = 0;
  if (mainMatch) score += 55;
  score += Math.min(30, shared.intersection * 12);
  score += Math.round(shared.ratio * 15);
  return clampScore(score, 100);
}

/** 価格類似度（0〜100）。現在価格優先 */
export function calculatePriceSimilarity(
  anchor: DmmItem,
  candidate: DmmItem,
): {
  score: number;
  diffRatio: number | null;
  diffYen: number | null;
} {
  const anchorPrice = getCurrentPrice(anchor);
  const candidatePrice = getCurrentPrice(candidate);
  if (anchorPrice == null || candidatePrice == null || anchorPrice <= 0) {
    return { score: 0, diffRatio: null, diffYen: null };
  }

  const diffYen = Math.abs(anchorPrice - candidatePrice);
  const diffRatio = diffYen / anchorPrice;

  let score = 0;
  if (diffRatio <= 0.05) score = 100;
  else if (diffRatio <= 0.1) score = 85;
  else if (diffRatio <= 0.2) score = 65;
  else if (diffRatio <= 0.3) score = 40;
  else if (diffRatio <= 0.5) score = 20;
  else score = 5;

  return { score, diffRatio, diffYen };
}

function calculateReleaseDateScore(
  anchor: DmmItem,
  candidate: DmmItem,
): number {
  const a = toTime(anchor.date);
  const b = toTime(candidate.date);
  if (a == null || b == null) return 0;
  const diffDays = Math.abs(a - b) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return 5;
  if (diffDays <= 90) return 4;
  if (diffDays <= 180) return 3;
  if (diffDays <= 365) return 2;
  if (diffDays <= 730) return 1;
  return 0;
}

function calculatePopularityScore(
  anchor: DmmItem,
  candidate: DmmItem,
): number {
  const a = getPopularityScore(anchor);
  const b = getPopularityScore(candidate);
  if (a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.4) return 2;
  if (ratio >= 0.2) return 1;
  return 0;
}

function buildReasons(
  result: Omit<SimilarityResult, "reasons" | "score" | "breakdown"> & {
    breakdown: SimilarityBreakdown;
    score: number;
    genreIntersection: number;
  },
): SimilarityReason[] {
  const reasons: SimilarityReason[] = [];

  if (result.sameMainActress) {
    reasons.push({ key: "main_actress", label: "同じメイン女優" });
  } else if (result.sharedActressCount >= 2) {
    reasons.push({
      key: "actresses",
      label: `出演女優が${result.sharedActressCount}名共通`,
    });
  } else if (result.sharedActressCount === 1) {
    reasons.push({ key: "actress", label: "同じ出演女優" });
  }

  if (result.genreIntersection > 0) {
    reasons.push({
      key: "genre",
      label: `ジャンルが${result.genreIntersection}件共通`,
    });
  }

  if (result.sameSeries) {
    reasons.push({ key: "series", label: "同じシリーズ" });
  }

  if (result.sameLabel) {
    reasons.push({ key: "label", label: "同じレーベル" });
  } else if (result.sameMaker) {
    reasons.push({ key: "maker", label: "同じメーカー" });
  }

  if (result.priceDiffYen != null && result.priceDiffYen >= 0) {
    reasons.push({
      key: "price",
      label:
        result.priceDiffYen === 0
          ? "価格が同じ"
          : `価格差${result.priceDiffYen.toLocaleString("ja-JP")}円`,
    });
  }

  return reasons.slice(0, 4);
}

/**
 * 総合類似度（100点満点目安）
 * シリーズ独占を抑えるため、シリーズ点はジャンル/女優と独立しつつ上限を調整
 */
export function calculateOverallSimilarity(
  anchor: DmmItem,
  candidate: DmmItem,
): SimilarityResult {
  const anchorActresses = getDmmItemActressNameList(anchor);
  const candidateActresses = getDmmItemActressNameList(candidate);
  const actressOverlap = jaccard(anchorActresses, candidateActresses);
  const sameMainActress =
    Boolean(anchorActresses[0]) &&
    Boolean(candidateActresses[0]) &&
    anchorActresses[0] === candidateActresses[0];

  const genreOverlap = jaccard(
    getDmmItemGenreNameList(anchor),
    getDmmItemGenreNameList(candidate),
  );

  const seriesA = getDmmItemSeriesName(anchor);
  const seriesB = getDmmItemSeriesName(candidate);
  const sameSeries = Boolean(seriesA && seriesB && seriesA === seriesB);

  const makerA = getDmmItemMakerName(anchor);
  const makerB = getDmmItemMakerName(candidate);
  const sameMaker = Boolean(makerA && makerB && makerA === makerB);

  const labelA = getDmmItemLabelName(anchor);
  const labelB = getDmmItemLabelName(candidate);
  const sameLabel = Boolean(labelA && labelB && labelA === labelB);

  // シリーズ点: 単独では上位独占しないよう、ジャンル一致がない場合は減点
  let seriesScore = 0;
  if (sameSeries) {
    seriesScore = genreOverlap.ratio >= 0.15 ? 25 : 12;
  }

  // 女優点: 共通を高く評価（最大25）
  let actressScore = 0;
  if (sameMainActress) {
    actressScore = 25;
  } else if (actressOverlap.intersection >= 2) {
    actressScore = 22;
  } else if (actressOverlap.intersection === 1) {
    actressScore = 18;
  }

  // ジャンル点: Jaccard × 25（一致率重視）
  const genreScore = Math.round(genreOverlap.ratio * 25);

  const makerOrLabelScore = sameLabel || sameMaker ? 10 : 0;
  const priceInfo = calculatePriceSimilarity(anchor, candidate);
  const priceScore = Math.round((priceInfo.score / 100) * 5);
  const releaseDateScore = calculateReleaseDateScore(anchor, candidate);
  const popularityScore = calculatePopularityScore(anchor, candidate);

  const breakdown: SimilarityBreakdown = {
    series: seriesScore,
    actress: actressScore,
    genre: genreScore,
    makerOrLabel: makerOrLabelScore,
    price: priceScore,
    releaseDate: releaseDateScore,
    popularity: popularityScore,
  };

  const score = clampScore(
    seriesScore +
      actressScore +
      genreScore +
      makerOrLabelScore +
      priceScore +
      releaseDateScore +
      popularityScore,
    100,
  );

  const partial = {
    score,
    breakdown,
    genreJaccard: genreOverlap.ratio,
    sharedActressCount: actressOverlap.intersection,
    sharedActressRatio: actressOverlap.ratio,
    priceDiffRatio: priceInfo.diffRatio,
    priceDiffYen: priceInfo.diffYen,
    sameSeries,
    sameMaker,
    sameLabel,
    sameMainActress,
    genreIntersection: genreOverlap.intersection,
  };

  return {
    score,
    breakdown,
    reasons: buildReasons(partial),
    genreJaccard: genreOverlap.ratio,
    sharedActressCount: actressOverlap.intersection,
    sharedActressRatio: actressOverlap.ratio,
    priceDiffRatio: priceInfo.diffRatio,
    priceDiffYen: priceInfo.diffYen,
    sameSeries,
    sameMaker,
    sameLabel,
    sameMainActress,
  };
}

export function getSortScore(
  sort: SimilaritySort,
  result: SimilarityResult,
  anchor: DmmItem,
  candidate: DmmItem,
): number {
  switch (sort) {
    case "genre": {
      // ジャンル主軸。低ジャンル類似は実質除外
      if (result.genreJaccard < 0.12) return 0;
      const actress = calculateActressSimilarity(anchor, candidate);
      return (
        result.genreJaccard * 70 +
        (result.sameSeries ? 8 : 0) +
        (result.sameMaker || result.sameLabel ? 6 : 0) +
        (actress / 100) * 10 +
        (result.breakdown.popularity / 5) * 6
      );
    }
    case "actress": {
      if (result.sharedActressCount === 0) return 0;
      const actress = calculateActressSimilarity(anchor, candidate);
      const popularity = getPopularityScore(candidate);
      const release = toTime(candidate.date) ?? 0;
      // 人気・新着をタイブレーク
      return actress * 1000 + Math.min(popularity, 1_000_000) / 1000 + release / 1e13;
    }
    case "price": {
      const price = calculatePriceSimilarity(anchor, candidate);
      if (price.diffRatio == null) return 0;
      return price.score * 10 + result.score;
    }
    case "overall":
    default:
      return result.score;
  }
}

export function parseSimilaritySort(
  value: string | null | undefined,
): SimilaritySort {
  if (
    value === "genre" ||
    value === "actress" ||
    value === "price" ||
    value === "overall"
  ) {
    return value;
  }
  return "overall";
}

export function getCurrentAndRegularPrice(item: DmmItem): {
  current: number | null;
  regular: number | null;
  discountRate: number | null;
} {
  const current = getCurrentPrice(item);
  const regular = getRegularPrice(item);
  let discountRate: number | null = null;
  if (current != null && regular != null && regular > current) {
    discountRate = Math.round(((regular - current) / regular) * 100);
  }
  return { current, regular, discountRate };
}
