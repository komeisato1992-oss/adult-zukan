import "server-only";

import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { SnsCompareWorkMini } from "@/lib/admin/sns-types";

const MAX_CANDIDATES = 50;
const MAX_PAIR_SELECTIONS = 3;
const MAX_WORK_REUSE = 2;

type WorkCandidate = {
  contentId: string;
  title: string;
  maker: string;
  genres: string[];
  price: number;
  releaseTimestamp: number;
  imageUrl?: string;
  actressNames: string;
  priceLabel?: string;
  releaseDate?: string;
  duration?: string;
  genresLabel: string;
};

type ScoredPair = {
  workA: WorkCandidate;
  workB: WorkCandidate;
  score: number;
  minCommonGenres: number;
};

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toWorkCandidate(item: DmmItem): WorkCandidate {
  const genres = (item.iteminfo?.genre ?? [])
    .map((genre) => genre.name)
    .filter(Boolean);
  const release = getDmmReleaseDateInfo(item);

  return {
    contentId: item.content_id,
    title: item.title,
    maker: getDmmItemMakerName(item) ?? "",
    genres,
    price: parseDmmPrice(item.prices?.price),
    releaseTimestamp: parseReleaseTimestamp(item),
    imageUrl: getDmmItemImageUrl(item),
    actressNames: getDmmItemActressNameList(item).join("、"),
    priceLabel: getDmmItemPrice(item),
    releaseDate: release?.value,
    duration: item.volume?.trim() ? `${item.volume}分` : undefined,
    genresLabel: genres.join("、"),
  };
}

function getCompareCandidates(items: DmmItem[]): WorkCandidate[] {
  const eligible = filterDisplayableItems(items).filter((item) => {
    const actresses = getDmmItemActressNameList(item);
    const price = parseDmmPrice(item.prices?.price);
    return actresses.length >= 1 && price > 0;
  });

  if (eligible.length <= MAX_CANDIDATES) {
    return eligible.map(toWorkCandidate);
  }

  const sampled: DmmItem[] = [];
  const step = eligible.length / MAX_CANDIDATES;

  for (let index = 0; index < MAX_CANDIDATES; index += 1) {
    sampled.push(eligible[Math.floor(index * step)]);
  }

  return sampled.map(toWorkCandidate);
}

function countCommonGenres(a: WorkCandidate, b: WorkCandidate): number {
  const genreSet = new Set(a.genres);
  return b.genres.filter((genre) => genreSet.has(genre)).length;
}

function scorePair(a: WorkCandidate, b: WorkCandidate): number {
  const commonGenres = countCommonGenres(a, b);
  if (commonGenres < 2) return -1;

  let score = commonGenres * 10;

  if (a.maker && a.maker === b.maker) {
    score += 15;
  }

  const priceDiff = Math.abs(a.price - b.price);
  score += Math.max(0, 20 - priceDiff / 100);

  const daysDiff =
    Math.abs(a.releaseTimestamp - b.releaseTimestamp) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 15 - daysDiff / 30);

  return score;
}

function scorePairRelaxed(a: WorkCandidate, b: WorkCandidate): number {
  const commonGenres = countCommonGenres(a, b);
  if (commonGenres < 1) return -1;

  let score = commonGenres * 8;

  if (a.maker && a.maker === b.maker) {
    score += 12;
  }

  const priceDiff = Math.abs(a.price - b.price);
  score += Math.max(0, 15 - priceDiff / 150);

  return score;
}

function buildScoredPairs(
  candidates: WorkCandidate[],
  scorer: (a: WorkCandidate, b: WorkCandidate) => number,
  minCommonGenres: number,
): ScoredPair[] {
  const pairs: ScoredPair[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const workA = candidates[i];
      const workB = candidates[j];
      const score = scorer(workA, workB);
      if (score <= 0) continue;

      pairs.push({
        workA,
        workB,
        score,
        minCommonGenres,
      });
    }
  }

  return pairs.sort((a, b) => b.score - a.score);
}

function toCompareWorkMini(work: WorkCandidate): SnsCompareWorkMini {
  return {
    contentId: work.contentId,
    title: work.title,
    imageUrl: work.imageUrl,
    actressNames: work.actressNames,
    price: work.priceLabel,
    releaseDate: work.releaseDate,
    duration: work.duration,
    genres: work.genresLabel,
  };
}

function samePair(a: ScoredPair, b: ScoredPair): boolean {
  return (
    (a.workA.contentId === b.workA.contentId &&
      a.workB.contentId === b.workB.contentId) ||
    (a.workA.contentId === b.workB.contentId &&
      a.workB.contentId === b.workA.contentId)
  );
}

function trySelectPairs(
  pairs: ScoredPair[],
  selected: ScoredPair[],
  usedCount: Map<string, number>,
  excludePairKeys?: Set<string>,
): void {
  for (const pair of pairs) {
    if (selected.length >= MAX_PAIR_SELECTIONS) break;
    if (selected.some((existing) => samePair(existing, pair))) continue;
    if (isExcludedComparePair(pair.workA, pair.workB, excludePairKeys)) continue;

    const countA = usedCount.get(pair.workA.contentId) ?? 0;
    const countB = usedCount.get(pair.workB.contentId) ?? 0;
    if (countA >= MAX_WORK_REUSE || countB >= MAX_WORK_REUSE) continue;

    selected.push(pair);
    usedCount.set(pair.workA.contentId, countA + 1);
    usedCount.set(pair.workB.contentId, countB + 1);
  }
}

export function comparePairKey(contentIdA: string, contentIdB: string): string {
  return [contentIdA, contentIdB].sort().join(",");
}

function isExcludedComparePair(
  workA: WorkCandidate,
  workB: WorkCandidate,
  excludePairKeys?: Set<string>,
): boolean {
  if (!excludePairKeys || excludePairKeys.size === 0) return false;
  return excludePairKeys.has(
    comparePairKey(workA.contentId, workB.contentId),
  );
}

function collectUniquePairs(candidates: WorkCandidate[]): ScoredPair[] {
  const pairs: ScoredPair[] = [];

  for (const batch of [
    buildScoredPairs(candidates, scorePair, 2),
    buildScoredPairs(candidates, scorePairRelaxed, 1),
  ]) {
    for (const pair of batch) {
      if (pairs.some((existing) => samePair(existing, pair))) continue;
      pairs.push(pair);
    }
  }

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const pair: ScoredPair = {
        workA: candidates[i],
        workB: candidates[j],
        score: 0,
        minCommonGenres: 0,
      };
      if (pairs.some((existing) => samePair(existing, pair))) continue;
      pairs.push(pair);
    }
  }

  return pairs.sort((a, b) => b.score - a.score);
}

export function pickAlternativeComparePair(
  items: DmmItem[],
  excludeContentIds?: [string, string],
  excludePairKeys?: Set<string>,
): [SnsCompareWorkMini, SnsCompareWorkMini] | null {
  const candidates = getCompareCandidates(items);
  if (candidates.length < 2) return null;

  const excludeKey =
    excludeContentIds?.length === 2
      ? comparePairKey(excludeContentIds[0], excludeContentIds[1])
      : null;
  const mergedExcludeKeys = new Set(excludePairKeys);
  if (excludeKey) {
    mergedExcludeKeys.add(excludeKey);
  }

  const available = collectUniquePairs(candidates).filter((pair) => {
    if (isExcludedComparePair(pair.workA, pair.workB, mergedExcludeKeys)) {
      return false;
    }
    return true;
  });

  if (available.length === 0) return null;

  const pool = available.slice(0, Math.min(10, available.length));
  const picked = pool[Math.floor(Math.random() * pool.length)];

  return [toCompareWorkMini(picked.workA), toCompareWorkMini(picked.workB)];
}

export function pickComparePairs(
  items: DmmItem[],
  excludePairKeys?: Set<string>,
): Array<[SnsCompareWorkMini, SnsCompareWorkMini]> {
  const candidates = getCompareCandidates(items);
  if (candidates.length < 2) return [];

  const selected: ScoredPair[] = [];
  const usedCount = new Map<string, number>();

  trySelectPairs(
    buildScoredPairs(candidates, scorePair, 2),
    selected,
    usedCount,
    excludePairKeys,
  );

  if (selected.length < MAX_PAIR_SELECTIONS) {
    trySelectPairs(
      buildScoredPairs(candidates, scorePairRelaxed, 1),
      selected,
      usedCount,
      excludePairKeys,
    );
  }

  if (selected.length < MAX_PAIR_SELECTIONS) {
    for (let i = 0; i < candidates.length && selected.length < MAX_PAIR_SELECTIONS; i += 1) {
      for (let j = i + 1; j < candidates.length && selected.length < MAX_PAIR_SELECTIONS; j += 1) {
        const pair: ScoredPair = {
          workA: candidates[i],
          workB: candidates[j],
          score: 0,
          minCommonGenres: 0,
        };
        if (selected.some((existing) => samePair(existing, pair))) continue;
        if (isExcludedComparePair(pair.workA, pair.workB, excludePairKeys)) continue;

        const countA = usedCount.get(pair.workA.contentId) ?? 0;
        const countB = usedCount.get(pair.workB.contentId) ?? 0;
        if (countA >= MAX_WORK_REUSE || countB >= MAX_WORK_REUSE) continue;

        selected.push(pair);
        usedCount.set(pair.workA.contentId, countA + 1);
        usedCount.set(pair.workB.contentId, countB + 1);
      }
    }
  }

  return selected.map(
    (pair) => [toCompareWorkMini(pair.workA), toCompareWorkMini(pair.workB)],
  );
}
