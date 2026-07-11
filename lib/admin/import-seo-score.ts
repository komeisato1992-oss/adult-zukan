import {
  getDmmItemActressNameList,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { parseDmmPrice } from "@/lib/utils";
import type { DmmItem } from "@/lib/dmm/types";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import {
  getActressCatalogWorkCount,
  getMakerCatalogWorkCount,
  getSeriesCatalogWorkCount,
  isPopularMakerName,
  isPopularSeriesName,
  type ImportSeoPopularityContext,
} from "@/lib/admin/import-seo-popularity";

export type ImportSeoScoreResult = {
  seoScore: number;
  seoReasons: string[];
  seoFlags: ImportSeoScoreFlags;
};

export type ImportSeoScoreFlags = {
  isRankingListed: boolean;
  isNewRelease: boolean;
  hasPopularActress: boolean;
  hasPopularMaker: boolean;
  hasPopularSeries: boolean;
  isOnSale: boolean;
};

export type ImportSeoScoreInput = {
  item: DmmItem;
  source?: string;
  collectionMode?: ImportCollectionMode;
  /** DMMランキング順位（1始まり）。上位ほど人気スコア補助に利用 */
  rankPosition?: number | null;
};

function isDmmItemOnSale(item: DmmItem): boolean {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
}

function daysSinceRelease(item: DmmItem): number | null {
  const raw = item.date?.trim();
  if (!raw) return null;

  const releaseDate = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(releaseDate.getTime())) return null;

  const diffMs = Date.now() - releaseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isRankingSource(input: ImportSeoScoreInput): boolean {
  if (input.collectionMode === "popular") return true;
  if (input.source === "fanza-rank") return true;
  return typeof input.rankPosition === "number" && input.rankPosition > 0;
}

function scoreActressPopularity(
  item: DmmItem,
  context: ImportSeoPopularityContext,
): { points: number; reasons: string[]; hasPopularActress: boolean } {
  const actresses = getDmmItemActressNameList(item);
  if (actresses.length === 0) {
    return { points: 0, reasons: [], hasPopularActress: false };
  }

  let best = 0;
  let bestName = "";
  let popularCount = 0;

  for (const actress of actresses) {
    const count = getActressCatalogWorkCount(context, actress);
    if (count >= 20) popularCount += 1;
    if (count > best) {
      best = count;
      bestName = actress;
    }
  }

  let points = 0;
  const reasons: string[] = [];

  if (best >= 100) {
    points = 80;
    reasons.push(`人気女優（${bestName}・${best}作品）`);
  } else if (best >= 50) {
    points = 60;
    reasons.push(`人気女優（${bestName}・${best}作品）`);
  } else if (best >= 20) {
    points = 40;
    reasons.push(`人気女優（${bestName}・${best}作品）`);
  } else if (bestName) {
    reasons.push(`${bestName}出演`);
  }

  if (popularCount >= 2) {
    points += 20;
    reasons.push("複数人気女優出演");
  }

  return {
    points,
    reasons,
    hasPopularActress: best >= 20,
  };
}

function scorePenalties(
  item: DmmItem,
  context: ImportSeoPopularityContext,
  actresses: string[],
  reviewCount: number,
): { penalty: number; reasons: string[] } {
  let demerits = 0;
  const reasons: string[] = [];

  const days = daysSinceRelease(item);
  if (days != null && days > 730) {
    demerits += 1;
    reasons.push("旧作");
  }

  const hasActress = actresses.length > 0;
  const hasPopularActress = actresses.some(
    (name) => getActressCatalogWorkCount(context, name) >= 20,
  );
  if (!hasActress || !hasPopularActress) {
    demerits += 1;
    if (!hasActress) reasons.push("女優情報なし");
    else reasons.push("人気女優なし");
  }

  if (reviewCount <= 0) {
    demerits += 1;
    reasons.push("レビューなし");
  }

  const series = getDmmItemSeriesName(item)?.trim();
  if (!series) {
    demerits += 1;
    reasons.push("シリーズなし");
  }

  const maker = getDmmItemMakerName(item)?.trim();
  if (!maker || !isPopularMakerName(context, maker)) {
    demerits += 1;
    reasons.push("メーカー知名度低");
  }

  if (demerits === 0) {
    return { penalty: 0, reasons: [] };
  }

  const penalty = Math.min(30, demerits * 6);
  return { penalty, reasons };
}

export function computeImportSeoScore(
  input: ImportSeoScoreInput,
  context: ImportSeoPopularityContext,
): ImportSeoScoreResult {
  const { item } = input;
  const reasons: string[] = [];
  let score = 0;

  const rankingListed = isRankingSource(input);
  if (rankingListed) {
    score += 100;
    reasons.push("ランキング作品");
  }

  const days = daysSinceRelease(item);
  let isNewRelease = false;
  if (days != null) {
    if (days <= 7) {
      score += 120;
      isNewRelease = true;
      reasons.push("発売7日以内");
    } else if (days <= 30) {
      score += 100;
      isNewRelease = true;
      reasons.push("発売30日以内");
    } else if (days <= 90) {
      score += 80;
      isNewRelease = true;
      reasons.push("発売90日以内");
    }
  }

  const actressScore = scoreActressPopularity(item, context);
  score += actressScore.points;
  reasons.push(...actressScore.reasons);

  const maker = getDmmItemMakerName(item)?.trim();
  const hasPopularMaker = isPopularMakerName(context, maker);
  if (hasPopularMaker && maker) {
    score += 40;
    const count = getMakerCatalogWorkCount(context, maker);
    reasons.push(`人気メーカー（${maker}・${count}作品）`);
  }

  const series = getDmmItemSeriesName(item)?.trim();
  const hasPopularSeries = isPopularSeriesName(context, series);
  if (hasPopularSeries && series) {
    score += 30;
    const count = getSeriesCatalogWorkCount(context, series);
    reasons.push(`人気シリーズ（${series}・${count}作品）`);
  }

  const reviewCount = item.review?.count ?? 0;
  if (reviewCount >= 100) {
    score += 50;
    reasons.push(`レビュー${reviewCount}件`);
  } else if (reviewCount >= 50) {
    score += 30;
    reasons.push(`レビュー${reviewCount}件`);
  } else if (reviewCount >= 20) {
    score += 10;
    reasons.push(`レビュー${reviewCount}件`);
  }

  const onSale = isDmmItemOnSale(item);
  if (onSale) {
    score += 20;
    reasons.push("セール中");
  }

  const actresses = getDmmItemActressNameList(item);
  const penalties = scorePenalties(item, context, actresses, reviewCount);
  score -= penalties.penalty;
  if (penalties.penalty > 0) {
    reasons.push(`優先度調整（-${penalties.penalty}）`);
  }

  const uniqueReasons = [...new Set(reasons.filter(Boolean))];

  return {
    seoScore: Math.max(0, score),
    seoReasons: uniqueReasons,
    seoFlags: {
      isRankingListed: rankingListed,
      isNewRelease,
      hasPopularActress: actressScore.hasPopularActress,
      hasPopularMaker,
      hasPopularSeries,
      isOnSale: onSale,
    },
  };
}

export { formatSeoStarRating } from "@/lib/admin/import-seo-display";

export function compareSeoScoreDesc(a: number, b: number): number {
  return b - a;
}
