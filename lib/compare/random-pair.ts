import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getCatalogWorks } from "@/lib/catalog";
import {
  BOTH_SIMILAR_MIN_SCORE,
  calculateOverallSimilarity,
} from "@/lib/compare/similarity";
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
import type { DmmItem } from "@/lib/dmm/types";
import {
  comparePopularWorks,
  hasPopularityData,
} from "@/lib/works/popularity";
import { parseReleaseTimestamp } from "@/lib/works/sort";

const POPULAR_POOL_SIZE = 300;
const NEW_POOL_SIZE = 300;
const TOP_CANDIDATE_COUNT = 5;
const PREFILTER_CAP = 800;

export type RandomComparisonPair = {
  seedWorkId: string;
  matchedWorkId: string;
  similarityScore: number;
};

type ScoredCandidate = {
  item: DmmItem;
  score: number;
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

function parseAddedTimestamp(item: DmmItem): number {
  const raw = item.addedAt?.trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 比較体験に使える公開作品か */
export function isEligibleRandomCompareWork(item: DmmItem): boolean {
  if (!isWorkPubliclyVisible(item)) return false;
  if (!getDmmListItemImageUrl(item) && !getDmmItemImageUrl(item)) return false;
  if (!getDmmFanzaUrl(item)) return false;
  if (!getDmmItemPrice(item)) return false;
  if (getDmmItemActressNameList(item).length === 0) return false;
  return true;
}

/**
 * 作品A選定（人気60% / 新着30% / その他10%）
 */
export function selectRandomSeedWork(items: DmmItem[]): DmmItem | null {
  if (items.length === 0) return null;

  const popular = items
    .filter(hasPopularityData)
    .sort(comparePopularWorks)
    .slice(0, POPULAR_POOL_SIZE);

  const newest = [...items]
    .sort((a, b) => {
      const addedDiff = parseAddedTimestamp(b) - parseAddedTimestamp(a);
      if (addedDiff !== 0) return addedDiff;
      return (parseReleaseTimestamp(b) ?? 0) - (parseReleaseTimestamp(a) ?? 0);
    })
    .slice(0, NEW_POOL_SIZE);

  const roll = Math.random();
  let pool: DmmItem[];
  if (roll < 0.6 && popular.length > 0) {
    pool = popular;
  } else if (roll < 0.9 && newest.length > 0) {
    pool = newest;
  } else {
    pool = items;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function collectRelatedIds(anchor: DmmItem, catalog: DmmItem[]): Set<string> {
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
    if (getDmmItemActressNameList(item).some((name) => actresses.has(name))) {
      ids.add(item.content_id);
      continue;
    }
    if (getDmmItemGenreNameList(item).some((name) => genres.has(name))) {
      ids.add(item.content_id);
    }
  }
  return ids;
}

/**
 * 作品Aと類似度の高い候補を取得（最大上位件数）
 */
export function getHighSimilarityCandidates(
  seed: DmmItem,
  catalog: DmmItem[],
  limit = TOP_CANDIDATE_COUNT,
): ScoredCandidate[] {
  const relatedIds = collectRelatedIds(seed, catalog);
  let pool = catalog.filter(
    (item) =>
      item.content_id !== seed.content_id &&
      relatedIds.has(item.content_id) &&
      isEligibleRandomCompareWork(item),
  );

  if (pool.length > PREFILTER_CAP) {
    pool = shuffleItems(pool).slice(0, PREFILTER_CAP);
  }

  const scored = pool
    .map((item) => ({
      item,
      score: calculateOverallSimilarity(seed, item).score,
    }))
    .sort((a, b) => b.score - a.score);

  const aboveMin = scored.filter((entry) => entry.score >= BOTH_SIMILAR_MIN_SCORE);
  if (aboveMin.length > 0) {
    return aboveMin.slice(0, limit);
  }

  // 最低点未満: シリーズ → 女優 → ジャンル → メーカー → 人気 の順で緩和
  const series = getDmmItemSeriesName(seed);
  const actresses = new Set(getDmmItemActressNameList(seed));
  const genres = new Set(getDmmItemGenreNameList(seed));
  const maker = getDmmItemMakerName(seed);
  const label = getDmmItemLabelName(seed);

  const fallbackBuckets: ScoredCandidate[][] = [[], [], [], [], []];
  for (const entry of scored) {
    const item = entry.item;
    if (series && getDmmItemSeriesName(item) === series) {
      fallbackBuckets[0].push(entry);
    } else if (
      getDmmItemActressNameList(item).some((name) => actresses.has(name))
    ) {
      fallbackBuckets[1].push(entry);
    } else if (getDmmItemGenreNameList(item).some((name) => genres.has(name))) {
      fallbackBuckets[2].push(entry);
    } else if (
      (maker && getDmmItemMakerName(item) === maker) ||
      (label && getDmmItemLabelName(item) === label)
    ) {
      fallbackBuckets[3].push(entry);
    } else if (hasPopularityData(item)) {
      fallbackBuckets[4].push(entry);
    }
  }

  const fallback: ScoredCandidate[] = [];
  for (const bucket of fallbackBuckets) {
    for (const entry of bucket) {
      fallback.push(entry);
      if (fallback.length >= limit) return fallback;
    }
  }

  return scored.slice(0, limit);
}

/** 上位候補から1件選択（上位3〜5件からランダム） */
export function selectSimilarWork(
  candidates: ScoredCandidate[],
): ScoredCandidate | null {
  if (candidates.length === 0) return null;
  const top = candidates.slice(0, Math.min(TOP_CANDIDATE_COUNT, candidates.length));
  // 品質優先: 上位ほど選ばれやすい重み付け
  const weights = top.map((_, index) => top.length - index);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < top.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return top[index];
  }
  return top[0] ?? null;
}

/**
 * ランダム比較ペア生成（押下時のみ呼び出し）
 */
export async function getRandomComparisonPair(): Promise<RandomComparisonPair | null> {
  noStore();

  const catalog = filterDisplayableItems(await getCatalogWorks())
    .filter(isWorkPubliclyVisible)
    .filter(isEligibleRandomCompareWork);

  if (catalog.length < 2) return null;

  // 最大3回リトライ（類似候補が取れない場合）
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seed = selectRandomSeedWork(catalog);
    if (!seed) return null;

    const candidates = getHighSimilarityCandidates(seed, catalog);
    const matched = selectSimilarWork(candidates);
    if (!matched) continue;

    return {
      seedWorkId: seed.content_id,
      matchedWorkId: matched.item.content_id,
      similarityScore: matched.score,
    };
  }

  return null;
}
