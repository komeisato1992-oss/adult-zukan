import "server-only";

import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { DMM_STATIC_WORKS_COUNT } from "@/lib/dmm/static-works";
import type { DmmItem } from "@/lib/dmm/types";

/**
 * 検索・一覧・女優ページ等で使う表示用カタログを選ぶ。
 *
 * 1. 一括追加は add-work.ts で先頭 prepend（新規作品優先）
 * 2. prepend 運用前に末尾へ追記された作品（2000件超の tail）は先頭へ昇格
 *    TODO: 将来は data/dmm/search-index.json を直接参照する案も検討
 */
export function selectCatalogDisplayItems(
  snapshot: DmmItem[],
  limit = DMM_STATIC_WORKS_COUNT,
): DmmItem[] {
  if (snapshot.length <= limit) {
    return snapshot;
  }

  const head = snapshot.slice(0, limit);
  const tail = snapshot.slice(limit);
  const headIds = new Set(head.map((item) => item.content_id));

  const tailOnly = tail.filter((item) => !headIds.has(item.content_id));
  if (tailOnly.length === 0) {
    return head;
  }

  const tailIds = new Set(tailOnly.map((item) => item.content_id));
  const trimmedHead = head.filter((item) => !tailIds.has(item.content_id));

  return [...tailOnly, ...trimmedHead].slice(0, limit);
}

export function getCatalogSnapshotFingerprint(
  snapshot: DmmItem[] = readCatalogSnapshot(),
): string {
  const first = snapshot[0]?.content_id ?? "";
  const last = snapshot[snapshot.length - 1]?.content_id ?? "";
  return `${snapshot.length}:${first}:${last}`;
}

export function logCatalogDisplayDebug(
  snapshot: DmmItem[],
  displayItems: DmmItem[],
  options?: { watchContentId?: string },
): void {
  if (process.env.NODE_ENV !== "development") return;

  const watchId = options?.watchContentId ?? "cemd00696";
  const snapshotIndex = snapshot.findIndex((item) => item.content_id === watchId);
  const displayIndex = displayItems.findIndex((item) => item.content_id === watchId);

  console.info("[catalog-display debug]", {
    catalogTotal: snapshot.length,
    displayCandidateCount: displayItems.length,
    first20ContentIds: snapshot.slice(0, 20).map((item) => item.content_id),
    watchContentId: watchId,
    watchIndexInSnapshot: snapshotIndex,
    watchInDisplaySlice: displayIndex >= 0,
    watchIndexInDisplay: displayIndex,
    searchTargetCount: displayItems.length,
    actressPageTargetCount: displayItems.length,
  });
}
