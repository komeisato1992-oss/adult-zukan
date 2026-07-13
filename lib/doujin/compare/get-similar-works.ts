import "server-only";

import { cache } from "react";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import {
  DOUJIN_BOTH_SIMILAR_MIN_SCORE,
  DOUJIN_COMPARE_SELECT_MAX_CANDIDATES,
  calculateDoujinSimilarity,
  getDoujinSortScore,
  type DoujinSimilaritySort,
} from "@/lib/doujin/compare/similarity";
import type {
  DoujinBothSimilarWorkCard,
  DoujinSimilarWorkCardData,
} from "@/lib/doujin/compare/types";
import { getDoujinPublicWorks } from "@/lib/doujin/catalog";
import type { DoujinWork } from "@/lib/doujin/types";

const MAX_SERIES_SHARE = 0.35;
const PREFILTER_CAP = 800;

function isEligible(work: DoujinWork): boolean {
  if (!work.id?.trim() || !work.title?.trim()) return false;
  const image = getDoujinCardImage(work);
  if (!image || image.includes("placeholder")) return false;
  if (!work.affiliateUrl?.trim()) return false;
  if (work.price == null || !Number.isFinite(work.price)) return false;
  return true;
}

function toCard(
  work: DoujinWork,
  score: number,
  reasonLabels: string[],
): DoujinSimilarWorkCardData {
  return {
    workId: work.id,
    title: work.title,
    imageUrl: getDoujinCardImage(work),
    circleName: work.circleName ?? work.circleNames?.[0],
    authorNames: work.authorNames ?? [],
    genreNames: work.genreNames ?? [],
    productFormat: work.productFormatNormalized ?? work.productFormat,
    price: work.price,
    similarityScore: Math.round(score),
    reasonLabels,
  };
}

function diversifyBySeries(
  scored: Array<{ work: DoujinWork; score: number; reasons: string[] }>,
  limit: number,
): Array<{ work: DoujinWork; score: number; reasons: string[] }> {
  const maxPerSeries = Math.max(2, Math.floor(limit * MAX_SERIES_SHARE));
  const seriesCount = new Map<string, number>();
  const picked: typeof scored = [];
  const deferred: typeof scored = [];

  for (const row of scored) {
    const seriesKey = row.work.seriesId?.trim() || `__${row.work.id}`;
    const count = seriesCount.get(seriesKey) ?? 0;
    if (count < maxPerSeries) {
      picked.push(row);
      seriesCount.set(seriesKey, count + 1);
    } else {
      deferred.push(row);
    }
    if (picked.length >= limit) break;
  }

  for (const row of deferred) {
    if (picked.length >= limit) break;
    picked.push(row);
  }
  return picked;
}

function scoreCatalog(
  anchor: DoujinWork,
  catalog: DoujinWork[],
  sort: DoujinSimilaritySort,
): Array<{ work: DoujinWork; score: number; reasons: string[]; sortScore: number }> {
  const scored: Array<{
    work: DoujinWork;
    score: number;
    reasons: string[];
    sortScore: number;
  }> = [];

  for (const work of catalog) {
    if (work.id === anchor.id) continue;
    if (!isEligible(work)) continue;
    const result = calculateDoujinSimilarity(anchor, work);
    const sortScore = getDoujinSortScore(result, sort);
    if (sort === "overall" && result.score < 8) continue;
    if (sort !== "overall" && sortScore <= 0) continue;
    scored.push({
      work,
      score: result.score,
      reasons: result.reasons.map((reason) => reason.label).slice(0, 3),
      sortScore,
    });
  }

  scored.sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
    return b.score - a.score;
  });

  return scored;
}

function prefilterRelated(
  anchor: DoujinWork,
  catalog: DoujinWork[],
): DoujinWork[] {
  const related: DoujinWork[] = [];
  const genreSet = new Set(anchor.genreNames ?? []);
  const circleSet = new Set(
    (anchor.circleIds?.length ? anchor.circleIds : [anchor.circleId])
      .filter(Boolean)
      .map((id) => String(id)),
  );
  const authorSet = new Set(anchor.authorIds ?? []);

  for (const work of catalog) {
    if (work.id === anchor.id) continue;
    if (
      (anchor.seriesId && work.seriesId === anchor.seriesId) ||
      (work.circleIds ?? [work.circleId]).some(
        (id) => id && circleSet.has(id),
      ) ||
      (work.authorIds ?? []).some((id) => authorSet.has(id)) ||
      (work.genreNames ?? []).some((name) => genreSet.has(name))
    ) {
      related.push(work);
      if (related.length >= PREFILTER_CAP) break;
    }
  }
  return related;
}

export const getDoujinSimilarWorks = cache(
  async (
    anchorWorkId: string,
    sort: DoujinSimilaritySort = "overall",
  ): Promise<DoujinSimilarWorkCardData[]> => {
    const catalog = getDoujinPublicWorks().filter(isEligible);
    const anchor = catalog.find((work) => work.id === anchorWorkId);
    if (!anchor) return [];

    let pool = prefilterRelated(anchor, catalog);
    if (pool.length < 40) {
      pool = catalog.filter((work) => work.id !== anchor.id);
    }

    let scored = scoreCatalog(anchor, pool, sort);
    if (scored.length < 20 && pool.length < catalog.length) {
      scored = scoreCatalog(
        anchor,
        catalog.filter((work) => work.id !== anchor.id),
        sort,
      );
    }

    const diversified = diversifyBySeries(
      scored,
      DOUJIN_COMPARE_SELECT_MAX_CANDIDATES,
    );

    return diversified.map((row) =>
      toCard(row.work, row.score, row.reasons),
    );
  },
);

export async function getDoujinCompareRelatedWorks(
  workIdA: string,
  workIdB: string,
  limitPerSection = 8,
): Promise<{
  both: DoujinBothSimilarWorkCard[];
  forA: DoujinSimilarWorkCardData[];
  forB: DoujinSimilarWorkCardData[];
}> {
  const catalog = getDoujinPublicWorks().filter(isEligible);
  const workA = catalog.find((work) => work.id === workIdA);
  const workB = catalog.find((work) => work.id === workIdB);
  if (!workA || !workB) {
    return { both: [], forA: [], forB: [] };
  }

  const both: DoujinBothSimilarWorkCard[] = [];
  const forA: DoujinSimilarWorkCardData[] = [];
  const forB: DoujinSimilarWorkCardData[] = [];
  const used = new Set<string>([workIdA, workIdB]);

  for (const work of catalog) {
    if (used.has(work.id)) continue;
    const scoreA = calculateDoujinSimilarity(workA, work);
    const scoreB = calculateDoujinSimilarity(workB, work);
    const average = (scoreA.score + scoreB.score) / 2;
    const spread = Math.abs(scoreA.score - scoreB.score);
    const minScore = Math.min(scoreA.score, scoreB.score);

    if (
      average >= DOUJIN_BOTH_SIMILAR_MIN_SCORE &&
      minScore >= 35 &&
      spread <= 35
    ) {
      both.push({
        ...toCard(
          work,
          average,
          [...scoreA.reasons, ...scoreB.reasons]
            .map((reason) => reason.label)
            .filter((label, index, arr) => arr.indexOf(label) === index)
            .slice(0, 3),
        ),
        averageScore: Math.round(average),
        scoreA: Math.round(scoreA.score),
        scoreB: Math.round(scoreB.score),
      });
    } else if (scoreA.score >= 40 && scoreA.score >= scoreB.score + 10) {
      forA.push(toCard(work, scoreA.score, scoreA.reasons.map((r) => r.label)));
    } else if (scoreB.score >= 40 && scoreB.score >= scoreA.score + 10) {
      forB.push(toCard(work, scoreB.score, scoreB.reasons.map((r) => r.label)));
    }
  }

  both.sort((a, b) => b.averageScore - a.averageScore);
  forA.sort((a, b) => b.similarityScore - a.similarityScore);
  forB.sort((a, b) => b.similarityScore - a.similarityScore);

  const takeBoth = both.slice(0, limitPerSection);
  for (const row of takeBoth) used.add(row.workId);

  return {
    both: takeBoth,
    forA: forA.filter((row) => !used.has(row.workId)).slice(0, limitPerSection),
    forB: forB.filter((row) => !used.has(row.workId)).slice(0, limitPerSection),
  };
}

/** 1〜4作品の平均類似度で候補を取る */
export async function getDoujinMultiCompareSimilarWorks(
  workIds: string[],
  limit = 12,
): Promise<DoujinSimilarWorkCardData[]> {
  const ids = workIds.map((id) => id.trim()).filter(Boolean).slice(0, 4);
  if (ids.length === 0) return [];

  const catalog = getDoujinPublicWorks().filter(isEligible);
  const anchors = ids
    .map((id) => catalog.find((work) => work.id === id))
    .filter((work): work is DoujinWork => Boolean(work));
  if (anchors.length === 0) return [];

  const used = new Set(anchors.map((work) => work.id));
  const scored: DoujinSimilarWorkCardData[] = [];

  for (const work of catalog) {
    if (used.has(work.id)) continue;
    const scores = anchors.map((anchor) =>
      calculateDoujinSimilarity(anchor, work),
    );
    const average =
      scores.reduce((sum, row) => sum + row.score, 0) / scores.length;
    const minScore = Math.min(...scores.map((row) => row.score));
    const maxScore = Math.max(...scores.map((row) => row.score));
    const spread = maxScore - minScore;
    if (average < 40 || minScore < 25 || spread > 40) continue;

    const reasonLabels = scores
      .flatMap((row) => row.reasons.map((reason) => reason.label))
      .filter((label, index, arr) => arr.indexOf(label) === index)
      .slice(0, 3);

    scored.push(toCard(work, average, reasonLabels));
  }

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, limit);
}
