import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import {
  DOUJIN_BOTH_SIMILAR_MIN_SCORE,
  calculateDoujinSimilarity,
} from "@/lib/doujin/compare/similarity";
import { getDoujinPublicWorks, sortDoujinWorks } from "@/lib/doujin/catalog";
import type { DoujinWork } from "@/lib/doujin/types";

const POPULAR_POOL_SIZE = 300;
const NEW_POOL_SIZE = 300;
const TOP_CANDIDATE_COUNT = 5;
const PREFILTER_CAP = 800;

export type DoujinRandomComparisonPair = {
  seedWorkId: string;
  matchedWorkId: string;
  similarityScore: number;
};

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function isEligibleDoujinRandomCompareWork(work: DoujinWork): boolean {
  if (!work.id?.trim() || !work.title?.trim()) return false;
  const image = getDoujinCardImage(work);
  if (!image || image.includes("placeholder")) return false;
  if (!work.affiliateUrl?.trim()) return false;
  if (work.price == null || !Number.isFinite(work.price)) return false;
  return true;
}

export function selectDoujinRandomSeedWork(
  items: DoujinWork[],
): DoujinWork | null {
  if (items.length === 0) return null;

  const popular = sortDoujinWorks(items, "popular").slice(0, POPULAR_POOL_SIZE);
  const newest = sortDoujinWorks(items, "new").slice(0, NEW_POOL_SIZE);

  const roll = Math.random();
  let pool: DoujinWork[];
  if (roll < 0.6 && popular.length > 0) {
    pool = popular;
  } else if (roll < 0.9 && newest.length > 0) {
    pool = newest;
  } else {
    pool = items;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function collectRelatedIds(
  anchor: DoujinWork,
  catalog: DoujinWork[],
): Set<string> {
  const ids = new Set<string>();
  const genres = new Set(anchor.genreNames ?? []);
  const circles = new Set(
    (anchor.circleIds?.length ? anchor.circleIds : [anchor.circleId]).filter(
      Boolean,
    ) as string[],
  );
  const authors = new Set(anchor.authorIds ?? []);

  for (const work of catalog) {
    if (work.id === anchor.id) continue;
    if (anchor.seriesId && work.seriesId === anchor.seriesId) {
      ids.add(work.id);
      continue;
    }
    if (
      (work.circleIds ?? [work.circleId]).some(
        (id) => id && circles.has(id),
      )
    ) {
      ids.add(work.id);
      continue;
    }
    if ((work.authorIds ?? []).some((id) => authors.has(id))) {
      ids.add(work.id);
      continue;
    }
    if ((work.genreNames ?? []).some((name) => genres.has(name))) {
      ids.add(work.id);
    }
    if (ids.size >= PREFILTER_CAP) break;
  }
  return ids;
}

export function getDoujinHighSimilarityCandidates(
  seed: DoujinWork,
  catalog: DoujinWork[],
): Array<{ work: DoujinWork; score: number }> {
  const relatedIds = collectRelatedIds(seed, catalog);
  const pool =
    relatedIds.size > 0
      ? catalog.filter((work) => relatedIds.has(work.id))
      : catalog.filter((work) => work.id !== seed.id);

  const scored: Array<{ work: DoujinWork; score: number }> = [];
  for (const work of pool) {
    if (work.id === seed.id) continue;
    if (!isEligibleDoujinRandomCompareWork(work)) continue;
    const result = calculateDoujinSimilarity(seed, work);
    if (result.score < Math.min(20, DOUJIN_BOTH_SIMILAR_MIN_SCORE / 2)) {
      continue;
    }
    scored.push({ work, score: result.score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_CANDIDATE_COUNT);
}

export function selectDoujinSimilarWork(
  candidates: Array<{ work: DoujinWork; score: number }>,
): { work: DoujinWork; score: number } | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((row, index) =>
    Math.max(1, candidates.length - index),
  );
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates[0] ?? null;
}

export async function getDoujinRandomComparisonPair(): Promise<DoujinRandomComparisonPair | null> {
  noStore();
  const catalog = getDoujinPublicWorks().filter(
    isEligibleDoujinRandomCompareWork,
  );
  if (catalog.length < 2) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seed = selectDoujinRandomSeedWork(shuffleItems(catalog));
    if (!seed) continue;
    const candidates = getDoujinHighSimilarityCandidates(seed, catalog);
    const matched = selectDoujinSimilarWork(candidates);
    if (!matched) continue;
    return {
      seedWorkId: seed.id,
      matchedWorkId: matched.work.id,
      similarityScore: Math.round(matched.score),
    };
  }

  return null;
}
