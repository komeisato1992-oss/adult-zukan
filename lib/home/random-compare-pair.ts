import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";

const POOL_SIZE = 50;
const TOP_MATCH_COUNT = 5;

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isEligibleCompareItem(item: DmmItem): boolean {
  return (
    Boolean(getDmmItemImageUrl(item)) &&
    Boolean(getDmmItemPrice(item)) &&
    Boolean(getDmmFanzaUrl(item)) &&
    getDmmItemActressNameList(item).length > 0
  );
}

function scorePartner(anchor: DmmItem, candidate: DmmItem): number {
  const anchorGenres = new Set(getDmmItemGenreNameList(anchor));
  const candidateGenres = getDmmItemGenreNameList(candidate);
  const commonGenres = candidateGenres.filter((genre) => anchorGenres.has(genre)).length;

  const anchorActresses = new Set(getDmmItemActressNameList(anchor));
  const sharedActress = getDmmItemActressNameList(candidate).some((name) =>
    anchorActresses.has(name),
  );

  return commonGenres * 3 + (sharedActress ? 2 : 0);
}

function buildEligiblePool(items: DmmItem[]): DmmItem[] {
  const eligible = filterDisplayableItems(items).filter(isEligibleCompareItem);
  if (eligible.length <= POOL_SIZE) {
    return eligible;
  }

  return shuffleItems(eligible).slice(0, POOL_SIZE);
}

export function pickRandomComparePair(
  items: DmmItem[],
): [DmmItem, DmmItem] | null {
  noStore();

  const pool = buildEligiblePool(items);
  if (pool.length < 2) return null;

  const shuffledPool = shuffleItems(pool);
  const anchor = shuffledPool[0];

  const partners = shuffledPool
    .slice(1)
    .map((item) => ({
      item,
      score: scorePartner(anchor, item),
    }))
    .sort((a, b) => b.score - a.score);

  const topMatches = partners.slice(0, TOP_MATCH_COUNT);
  const partner =
    topMatches[Math.floor(Math.random() * topMatches.length)]?.item ??
    partners[0]?.item;

  if (!partner) return null;

  return [anchor, partner];
}
