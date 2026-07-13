import type { DoujinWork } from "@/lib/doujin/types";

export type DoujinSimilaritySort =
  | "overall"
  | "genre"
  | "circle_author"
  | "price";

export const DOUJIN_SIMILARITY_SORTS: readonly DoujinSimilaritySort[] = [
  "overall",
  "genre",
  "circle_author",
  "price",
] as const;

export const DOUJIN_SIMILARITY_SORT_LABELS: Record<
  DoujinSimilaritySort,
  string
> = {
  overall: "総合的に似ている",
  genre: "ジャンルが似ている",
  circle_author: "サークル・作者が共通",
  price: "価格が近い",
};

export const DOUJIN_COMPARE_SELECT_PAGE_SIZE = 10;
export const DOUJIN_COMPARE_SELECT_MAX_CANDIDATES = 100;
export const DOUJIN_COMPARE_SELECT_MAX_PAGES = 10;
export const DOUJIN_BOTH_SIMILAR_MIN_SCORE = 55;

export type DoujinSimilarityReason = {
  key: string;
  label: string;
};

export type DoujinSimilarityBreakdown = {
  series: number;
  circle: number;
  author: number;
  genre: number;
  format: number;
  price: number;
  releaseDate: number;
  popularity: number;
};

export type DoujinSimilarityResult = {
  score: number;
  breakdown: DoujinSimilarityBreakdown;
  reasons: DoujinSimilarityReason[];
  genreJaccard: number;
  priceDiffRatio: number | null;
  sameSeries: boolean;
  sameCircle: boolean;
  sameAuthor: boolean;
  sameFormat: boolean;
};

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, value);
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

function circleIds(work: DoujinWork): string[] {
  if (Array.isArray(work.circleIds) && work.circleIds.length > 0) {
    return work.circleIds.map((id) => id.trim()).filter(Boolean);
  }
  return work.circleId?.trim() ? [work.circleId.trim()] : [];
}

function authorIds(work: DoujinWork): string[] {
  return (work.authorIds ?? []).map((id) => id.trim()).filter(Boolean);
}

function genreNames(work: DoujinWork): string[] {
  return (work.genreNames ?? []).map((name) => name.trim()).filter(Boolean);
}

function formatKey(work: DoujinWork): string {
  return (work.productFormatNormalized || work.productFormat || "")
    .trim()
    .toLowerCase();
}

function toTime(value?: string): number | null {
  if (!value?.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function popularityRank(work: DoujinWork): number {
  return (
    work.currentPopularRank ??
    work.initialPopularRank ??
    work.newImportRank ??
    Number.MAX_SAFE_INTEGER
  );
}

export function calculateDoujinGenreSimilarity(
  anchor: DoujinWork,
  candidate: DoujinWork,
): number {
  return jaccard(genreNames(anchor), genreNames(candidate)).ratio;
}

export function calculateCircleAuthorSimilarity(
  anchor: DoujinWork,
  candidate: DoujinWork,
): number {
  const circle = jaccard(circleIds(anchor), circleIds(candidate));
  const author = jaccard(authorIds(anchor), authorIds(candidate));
  return clampScore(circle.ratio * 55 + author.ratio * 45, 100);
}

export function calculateDoujinPriceSimilarity(
  anchor: DoujinWork,
  candidate: DoujinWork,
): number {
  const a = anchor.price;
  const b = candidate.price;
  if (a == null || b == null || a <= 0 || b <= 0) return 0;
  const ratio = Math.abs(a - b) / Math.max(a, b);
  if (ratio <= 0.05) return 5;
  if (ratio <= 0.15) return 4;
  if (ratio <= 0.3) return 3;
  if (ratio <= 0.5) return 1;
  return 0;
}

/**
 * 同人向け総合類似度（100点満点）
 * シリーズ25 / サークル20 / 作者15 / ジャンル25 / 形式5 / 価格5 / 発売3 / 人気2
 */
export function calculateDoujinSimilarity(
  anchor: DoujinWork,
  candidate: DoujinWork,
): DoujinSimilarityResult {
  const reasons: DoujinSimilarityReason[] = [];
  const sameSeries = Boolean(
    anchor.seriesId &&
      candidate.seriesId &&
      anchor.seriesId === candidate.seriesId,
  );
  const seriesScore = sameSeries ? 25 : 0;
  if (sameSeries) {
    reasons.push({ key: "series", label: "同じシリーズ" });
  }

  const circle = jaccard(circleIds(anchor), circleIds(candidate));
  const circleScore = clampScore(circle.ratio * 20, 20);
  const sameCircle = circle.intersection > 0;
  if (sameCircle) {
    reasons.push({
      key: "circle",
      label:
        circle.intersection > 1
          ? `サークルが${circle.intersection}件共通`
          : "同じサークル",
    });
  }

  const author = jaccard(authorIds(anchor), authorIds(candidate));
  const authorScore = clampScore(author.ratio * 15, 15);
  const sameAuthor = author.intersection > 0;
  if (sameAuthor) {
    reasons.push({
      key: "author",
      label:
        author.intersection > 1
          ? `作者が${author.intersection}人共通`
          : "同じ作者",
    });
  }

  const genre = jaccard(genreNames(anchor), genreNames(candidate));
  const genreScore = clampScore(genre.ratio * 25, 25);
  if (genre.intersection > 0) {
    reasons.push({
      key: "genre",
      label: `ジャンルが${genre.intersection}件共通`,
    });
  }

  const sameFormat =
    Boolean(formatKey(anchor)) && formatKey(anchor) === formatKey(candidate);
  const formatScore = sameFormat ? 5 : 0;
  if (sameFormat) {
    reasons.push({ key: "format", label: "作品形式が同じ" });
  }

  const priceScore = calculateDoujinPriceSimilarity(anchor, candidate);
  const aPrice = anchor.price;
  const bPrice = candidate.price;
  const priceDiffRatio =
    aPrice != null && bPrice != null && Math.max(aPrice, bPrice) > 0
      ? Math.abs(aPrice - bPrice) / Math.max(aPrice, bPrice)
      : null;
  if (priceScore >= 3) {
    reasons.push({ key: "price", label: "価格帯が近い" });
  }

  let releaseScore = 0;
  const tA = toTime(anchor.releaseDate);
  const tB = toTime(candidate.releaseDate);
  if (tA != null && tB != null) {
    const days = Math.abs(tA - tB) / (1000 * 60 * 60 * 24);
    if (days <= 90) releaseScore = 3;
    else if (days <= 365) releaseScore = 2;
    else if (days <= 730) releaseScore = 1;
  }

  let popularityScore = 0;
  const rA = popularityRank(anchor);
  const rB = popularityRank(candidate);
  if (
    rA < Number.MAX_SAFE_INTEGER &&
    rB < Number.MAX_SAFE_INTEGER &&
    Math.abs(rA - rB) <= 50
  ) {
    popularityScore = 2;
  } else if (
    (anchor.rating ?? 0) >= 4 &&
    (candidate.rating ?? 0) >= 4
  ) {
    popularityScore = 1;
  }

  const breakdown: DoujinSimilarityBreakdown = {
    series: seriesScore,
    circle: circleScore,
    author: authorScore,
    genre: genreScore,
    format: formatScore,
    price: priceScore,
    releaseDate: releaseScore,
    popularity: popularityScore,
  };

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    score: Math.round(score * 10) / 10,
    breakdown,
    reasons,
    genreJaccard: genre.ratio,
    priceDiffRatio,
    sameSeries,
    sameCircle,
    sameAuthor,
    sameFormat,
  };
}

export function getDoujinSortScore(
  result: DoujinSimilarityResult,
  sort: DoujinSimilaritySort,
): number {
  switch (sort) {
    case "genre":
      return result.breakdown.genre * 4 + result.breakdown.series;
    case "circle_author":
      return (
        result.breakdown.circle * 3 +
        result.breakdown.author * 3 +
        result.breakdown.series
      );
    case "price":
      return result.breakdown.price * 20 + result.breakdown.genre;
    case "overall":
    default:
      return result.score;
  }
}

export function parseDoujinSimilaritySort(
  value?: string | null,
): DoujinSimilaritySort {
  if (
    value === "genre" ||
    value === "circle_author" ||
    value === "price" ||
    value === "overall"
  ) {
    return value;
  }
  return "overall";
}
