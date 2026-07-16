import type { DmmItem } from "@/lib/dmm/types";
import { isWorkOnSale } from "@/lib/dmm/work-sale-info";

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSyncTimestamp(item: DmmItem): number {
  const raw = item.lastSyncedAt ?? item.lastRefreshedAt;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 全件同期時の更新優先度（高いほど先） */
export function sortWorksForFanzaSync(items: DmmItem[]): DmmItem[] {
  const now = Date.now();

  return [...items].sort((a, b) => {
    const scoreA = computeSyncPriorityScore(a, now);
    const scoreB = computeSyncPriorityScore(b, now);
    if (scoreA !== scoreB) return scoreB - scoreA;

    const staleA = parseSyncTimestamp(a);
    const staleB = parseSyncTimestamp(b);
    if (staleA !== staleB) return staleA - staleB;

    return a.content_id.localeCompare(b.content_id);
  });
}

function computeSyncPriorityScore(item: DmmItem, now: number): number {
  let score = 0;

  if (isWorkOnSale(item, now)) {
    score += 1_000_000;
  }

  if (
    typeof item.sourcePopularityRank === "number" &&
    item.sourcePopularityRank > 0
  ) {
    score += Math.max(0, 100_000 - item.sourcePopularityRank);
  }

  const releaseTs = parseReleaseTimestamp(item);
  if (releaseTs > now - 30 * 24 * 60 * 60 * 1000) {
    score += 50_000;
  }

  const syncedAt = parseSyncTimestamp(item);
  if (syncedAt === 0) {
    score += 40_000;
  } else {
    const ageHours = (now - syncedAt) / (1000 * 60 * 60);
    if (ageHours >= 24) {
      score += Math.min(30_000, Math.floor(ageHours * 10));
    }
  }

  return score;
}

/** カーソル継続用の安定順（cid昇順）。オフセットがずれないようにする。 */
export function sortWorksForFanzaSyncStable(items: DmmItem[]): DmmItem[] {
  return [...items].sort((a, b) => a.content_id.localeCompare(b.content_id));
}

export function selectFanzaSyncBatch(
  sortedItems: DmmItem[],
  cursor: number,
  batchSize: number,
): DmmItem[] {
  if (sortedItems.length === 0) return [];
  const safeCursor = Math.max(0, Math.min(cursor, sortedItems.length));
  return sortedItems.slice(safeCursor, safeCursor + batchSize);
}
