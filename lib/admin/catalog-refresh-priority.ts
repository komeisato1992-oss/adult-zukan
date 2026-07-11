import type { CatalogRefreshStrategy } from "@/lib/dmm/catalog-refresh-types";
import type { DmmItem } from "@/lib/dmm/types";
import { isWorkOnSale } from "@/lib/dmm/work-sale-info";

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRefreshTimestamp(item: DmmItem): number {
  const raw = item.lastRefreshedAt?.trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 更新優先度で並べ替え（高いほど先に更新） */
export function sortCatalogWorksForRefresh(
  items: DmmItem[],
  strategy: CatalogRefreshStrategy,
): DmmItem[] {
  const now = Date.now();

  return [...items].sort((a, b) => {
    const scoreA = computeRefreshPriorityScore(a, strategy, now);
    const scoreB = computeRefreshPriorityScore(b, strategy, now);
    if (scoreA !== scoreB) return scoreB - scoreA;

    const staleA = parseRefreshTimestamp(a);
    const staleB = parseRefreshTimestamp(b);
    if (staleA !== staleB) return staleA - staleB;

    return a.content_id.localeCompare(b.content_id);
  });
}

function computeRefreshPriorityScore(
  item: DmmItem,
  strategy: CatalogRefreshStrategy,
  now: number,
): number {
  let score = 0;

  if (strategy.prioritizeSale && isWorkOnSale(item, now)) {
    score += 1_000_000;
  }

  if (
    strategy.prioritizePopular &&
    typeof item.sourcePopularityRank === "number" &&
    item.sourcePopularityRank > 0
  ) {
    score += Math.max(0, 100_000 - item.sourcePopularityRank);
  }

  if (strategy.prioritizeStale) {
    const refreshedAt = parseRefreshTimestamp(item);
    if (refreshedAt === 0) {
      score += 50_000;
    } else {
      const ageDays = (now - refreshedAt) / (1000 * 60 * 60 * 24);
      score += Math.min(40_000, Math.floor(ageDays * 100));
    }
  }

  score += Math.floor(parseReleaseTimestamp(item) / 1_000_000_000);

  return score;
}

export function selectRefreshBatch(
  items: DmmItem[],
  offset: number,
  batchSize: number,
  strategy: CatalogRefreshStrategy,
): {
  batch: DmmItem[];
  catalogCount: number;
  nextOffset: number;
  cycled: boolean;
} {
  const sorted = sortCatalogWorksForRefresh(items, strategy);
  const catalogCount = sorted.length;
  const safeOffset = catalogCount === 0 ? 0 : offset % catalogCount;
  const batch = sorted.slice(safeOffset, safeOffset + batchSize);
  const nextOffset = safeOffset + batch.length;
  const cycled = catalogCount > 0 && nextOffset >= catalogCount;

  return {
    batch,
    catalogCount,
    nextOffset: cycled ? 0 : nextOffset,
    cycled,
  };
}
