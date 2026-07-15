import "server-only";

import { cache } from "react";
import {
  BOTH_SIMILAR_MIN_SCORE,
  COMPARE_SELECT_MAX_CANDIDATES,
  calculateOverallSimilarity,
  getCurrentAndRegularPrice,
  getSortScore,
  type SimilarityResult,
  type SimilaritySort,
} from "@/lib/compare/similarity";
import type {
  BothSimilarWorkCard,
  SimilarWorkCardData,
} from "@/lib/compare/types";
import { getCatalogWorks } from "@/lib/catalog";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmItemSeriesName,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { isWorkPubliclyVisible } from "@/lib/dmm/catalog-visibility";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { DmmItem } from "@/lib/dmm/types";
import { getPopularityScore } from "@/lib/works/popularity";

const MAX_SERIES_SHARE = 0.35;
const PREFILTER_SOFT_CAP = 1200;

export type { BothSimilarWorkCard, SimilarWorkCardData } from "@/lib/compare/types";
export { formatPriceYen } from "@/lib/compare/types";

type ScoredCandidate = {
  item: DmmItem;
  result: SimilarityResult;
  sortScore: number;
};

function isEligibleCandidate(item: DmmItem, anchorId: string): boolean {
  if (item.content_id === anchorId) return false;
  if (!isWorkPubliclyVisible(item)) return false;
  if (!getDmmListItemImageUrl(item) && !getDmmItemImageUrl(item)) return false;
  if (!getDmmFanzaUrl(item)) return false;
  return true;
}

function collectPrefilterIds(anchor: DmmItem, catalog: DmmItem[]): Set<string> {
  const ids = new Set<string>();
  const actresses = new Set(getDmmItemActressNameList(anchor));
  const genres = new Set(getDmmItemGenreNameList(anchor));
  const series = getDmmItemSeriesName(anchor);
  const maker = getDmmItemMakerName(anchor);
  const label = getDmmItemLabelName(anchor);

  for (const item of catalog) {
    if (item.content_id === anchor.content_id) continue;

    if (series && getDmmItemSeriesName(item) === series) {
      ids.add(item.content_id);
      continue;
    }

    if (maker && getDmmItemMakerName(item) === maker) {
      ids.add(item.content_id);
      continue;
    }

    if (label && getDmmItemLabelName(item) === label) {
      ids.add(item.content_id);
      continue;
    }

    const itemActresses = getDmmItemActressNameList(item);
    if (itemActresses.some((name) => actresses.has(name))) {
      ids.add(item.content_id);
      continue;
    }

    const itemGenres = getDmmItemGenreNameList(item);
    if (itemGenres.some((name) => genres.has(name))) {
      ids.add(item.content_id);
    }
  }

  return ids;
}

function diversifyBySeries(scored: ScoredCandidate[]): ScoredCandidate[] {
  const maxSameSeries = Math.max(
    8,
    Math.floor(COMPARE_SELECT_MAX_CANDIDATES * MAX_SERIES_SHARE),
  );
  const seriesCount = new Map<string, number>();
  const selected: ScoredCandidate[] = [];
  const deferred: ScoredCandidate[] = [];

  for (const entry of scored) {
    const series = getDmmItemSeriesName(entry.item);
    if (!series) {
      selected.push(entry);
      continue;
    }
    const count = seriesCount.get(series) ?? 0;
    if (count < maxSameSeries) {
      seriesCount.set(series, count + 1);
      selected.push(entry);
    } else {
      deferred.push(entry);
    }
  }

  for (const entry of deferred) {
    if (selected.length >= COMPARE_SELECT_MAX_CANDIDATES) break;
    selected.push(entry);
  }

  return selected.slice(0, COMPARE_SELECT_MAX_CANDIDATES);
}

function scoreCandidates(
  anchor: DmmItem,
  candidates: DmmItem[],
  sort: SimilaritySort,
): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];

  for (const item of candidates) {
    const result = calculateOverallSimilarity(anchor, item);
    const sortScore = getSortScore(sort, result, anchor, item);

    if (sort === "actress" && result.sharedActressCount === 0) continue;
    if (sort === "genre" && sortScore <= 0) continue;
    if (sort === "price" && result.priceDiffRatio == null) continue;
    if (sort === "overall" && result.score < 8) continue;

    scored.push({ item, result, sortScore });
  }

  scored.sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
    if (b.result.score !== a.result.score) return b.result.score - a.result.score;
    return (getPopularityScore(b.item) || 0) - (getPopularityScore(a.item) || 0);
  });

  return scored;
}

function relaxCandidates(
  anchor: DmmItem,
  catalog: DmmItem[],
  existingIds: Set<string>,
  needed: number,
): DmmItem[] {
  if (needed <= 0) return [];

  const genres = new Set(getDmmItemGenreNameList(anchor));
  const maker = getDmmItemMakerName(anchor);
  const actresses = new Set(getDmmItemActressNameList(anchor));
  const series = getDmmItemSeriesName(anchor);

  const buckets: DmmItem[][] = [[], [], [], [], []];

  for (const item of catalog) {
    if (existingIds.has(item.content_id)) continue;
    if (!isEligibleCandidate(item, anchor.content_id)) continue;

    const itemActresses = getDmmItemActressNameList(item);
    const sharedActress = itemActresses.some((name) => actresses.has(name));
    const sameSeries =
      Boolean(series) && getDmmItemSeriesName(item) === series;
    const sharedGenre = getDmmItemGenreNameList(item).some((name) =>
      genres.has(name),
    );
    const sameMaker = Boolean(maker) && getDmmItemMakerName(item) === maker;

    if (sharedActress || sameSeries) buckets[0].push(item);
    else if (sharedGenre) buckets[1].push(item);
    else if (sameMaker) buckets[2].push(item);
    else if (getPopularityScore(item) > 0) buckets[3].push(item);
    else buckets[4].push(item);
  }

  for (const bucket of buckets) {
    bucket.sort(
      (a, b) => (getPopularityScore(b) || 0) - (getPopularityScore(a) || 0),
    );
  }

  const picked: DmmItem[] = [];
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (picked.length >= needed) return picked;
      // 無関係作品の大量投入を避ける: 最後のバケットは少数のみ
      if (bucket === buckets[4] && picked.length >= Math.min(needed, 10)) {
        return picked;
      }
      picked.push(item);
    }
  }
  return picked;
}

function toCardData(
  entry: ScoredCandidate,
): SimilarWorkCardData {
  const { item, result } = entry;
  const prices = getCurrentAndRegularPrice(item);
  const reviewAverage = item.review?.average?.trim();

  return {
    contentId: item.content_id,
    title: item.title,
    imageUrl: getDmmListItemImageUrl(item) ?? getDmmItemImageUrl(item),
    actressNames: getDmmItemActressNameList(item),
    makerName: getDmmItemMakerName(item),
    labelName: getDmmItemLabelName(item),
    price: getDmmItemPrice(item),
    currentPrice: prices.current,
    regularPrice: prices.regular,
    discountRate: prices.discountRate,
    priceDiffYen: result.priceDiffYen,
    rating: reviewAverage || undefined,
    releaseDate: getDmmReleaseDateInfo(item)?.value,
    similarityScore: result.score,
    reasons: result.reasons,
    fanzaUrl: getDmmFanzaUrl(item) ?? "",
  };
}

/**
 * 類似作品を最大100件取得（サーバー側）
 * 全カタログへの単純総当たりを避け、共有属性で事前絞り込みする
 */
export const getSimilarWorks = cache(
  async (
    anchorContentId: string,
    sort: SimilaritySort = "overall",
  ): Promise<SimilarWorkCardData[]> => {
    const catalog = filterDisplayableItems(await getCatalogWorks()).filter(
      isWorkPubliclyVisible,
    );
    const anchor = catalog.find((item) => item.content_id === anchorContentId);
    if (!anchor) return [];

    const prefilterIds = collectPrefilterIds(anchor, catalog);
    let pool = catalog.filter(
      (item) =>
        prefilterIds.has(item.content_id) &&
        isEligibleCandidate(item, anchor.content_id),
    );

    if (pool.length > PREFILTER_SOFT_CAP) {
      pool = pool
        .map((item) => ({
          item,
          popularity: getPopularityScore(item) || 0,
        }))
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, PREFILTER_SOFT_CAP)
        .map((entry) => entry.item);
    }

    let scored = scoreCandidates(anchor, pool, sort);
    scored = diversifyBySeries(scored);

    if (scored.length < COMPARE_SELECT_MAX_CANDIDATES) {
      const existing = new Set(scored.map((entry) => entry.item.content_id));
      existing.add(anchor.content_id);
      const relaxed = relaxCandidates(
        anchor,
        catalog,
        existing,
        COMPARE_SELECT_MAX_CANDIDATES - scored.length,
      );
      const extra = scoreCandidates(anchor, relaxed, sort);
      scored = diversifyBySeries([...scored, ...extra]);
    }

    const top = scored.slice(0, COMPARE_SELECT_MAX_CANDIDATES);
    const { mergeLiveStatusIntoItems } = await import(
      "@/lib/dmm/work-live-status"
    );
    const liveItems = await mergeLiveStatusIntoItems(
      top.map((entry) => entry.item),
    );
    const liveById = new Map(
      liveItems.map((item) => [item.content_id, item]),
    );

    return top.map((entry) =>
      toCardData({
        ...entry,
        item: liveById.get(entry.item.content_id) ?? entry.item,
      }),
    );
  },
);

function toRelatedCard(
  item: DmmItem,
  result: SimilarityResult,
  source: "both" | "a" | "b",
  scoreA: number,
  scoreB: number,
): BothSimilarWorkCard {
  const base = toCardData({
    item,
    result,
    sortScore: result.score,
  });
  return {
    ...base,
    scoreA,
    scoreB,
    bothScore: scoreA * 0.5 + scoreB * 0.5,
    source,
  };
}

/**
 * 比較ページ下部用: 両作品に似ている / Aに似ている / Bに似ている
 */
export async function getCompareRelatedWorks(
  contentIdA: string,
  contentIdB: string,
  limitPerSection = 8,
): Promise<{
  both: BothSimilarWorkCard[];
  forA: BothSimilarWorkCard[];
  forB: BothSimilarWorkCard[];
}> {
  const catalog = filterDisplayableItems(await getCatalogWorks()).filter(
    isWorkPubliclyVisible,
  );
  const workA = catalog.find((item) => item.content_id === contentIdA);
  const workB = catalog.find((item) => item.content_id === contentIdB);
  if (!workA || !workB) {
    return { both: [], forA: [], forB: [] };
  }

  const exclude = new Set([contentIdA, contentIdB]);
  const prefilter = new Set([
    ...collectPrefilterIds(workA, catalog),
    ...collectPrefilterIds(workB, catalog),
  ]);

  const pool = catalog.filter(
    (item) =>
      !exclude.has(item.content_id) &&
      prefilter.has(item.content_id) &&
      isEligibleCandidate(item, contentIdA),
  );

  const both: BothSimilarWorkCard[] = [];
  const forA: BothSimilarWorkCard[] = [];
  const forB: BothSimilarWorkCard[] = [];

  for (const item of pool) {
    const resultA = calculateOverallSimilarity(workA, item);
    const resultB = calculateOverallSimilarity(workB, item);

    if (
      resultA.score >= BOTH_SIMILAR_MIN_SCORE &&
      resultB.score >= BOTH_SIMILAR_MIN_SCORE
    ) {
      const bothScore = resultA.score * 0.5 + resultB.score * 0.5;
      both.push(
        toRelatedCard(
          item,
          {
            ...resultA,
            score: Math.round(bothScore),
            reasons: [
              ...resultA.reasons.slice(0, 2),
              ...resultB.reasons
                .filter(
                  (reason) =>
                    !resultA.reasons.some((left) => left.key === reason.key),
                )
                .slice(0, 2),
            ].slice(0, 4),
          },
          "both",
          resultA.score,
          resultB.score,
        ),
      );
    }

    if (resultA.score >= 40) {
      forA.push(toRelatedCard(item, resultA, "a", resultA.score, resultB.score));
    }
    if (resultB.score >= 40) {
      forB.push(toRelatedCard(item, resultB, "b", resultA.score, resultB.score));
    }
  }

  both.sort((a, b) => b.bothScore - a.bothScore);
  forA.sort((a, b) => b.scoreA - a.scoreA);
  forB.sort((a, b) => b.scoreB - a.scoreB);

  const bothTop = both.slice(0, limitPerSection);
  const bothIds = new Set(bothTop.map((w) => w.contentId));
  const forATop = forA
    .filter((w) => !bothIds.has(w.contentId))
    .slice(0, limitPerSection);
  const forBTop = forB
    .filter((w) => !bothIds.has(w.contentId))
    .slice(0, limitPerSection);

  const displayIds = [
    ...new Set(
      [...bothTop, ...forATop, ...forBTop].map((card) => card.contentId),
    ),
  ];
  const { mergeLiveStatusIntoItems } = await import(
    "@/lib/dmm/work-live-status"
  );
  const liveItems = await mergeLiveStatusIntoItems(
    displayIds
      .map((id) => catalog.find((item) => item.content_id === id))
      .filter((item): item is DmmItem => Boolean(item)),
  );
  const liveById = new Map(liveItems.map((item) => [item.content_id, item]));

  function withLivePrice<T extends SimilarWorkCardData>(card: T): T {
    const item = liveById.get(card.contentId);
    if (!item) return card;
    const prices = getCurrentAndRegularPrice(item);
    const reviewAverage = item.review?.average?.trim();
    return {
      ...card,
      price: getDmmItemPrice(item),
      currentPrice: prices.current,
      regularPrice: prices.regular,
      discountRate: prices.discountRate,
      rating: reviewAverage || card.rating,
    };
  }

  return {
    both: bothTop.map(withLivePrice),
    forA: forATop.map(withLivePrice),
    forB: forBTop.map(withLivePrice),
  };
}
