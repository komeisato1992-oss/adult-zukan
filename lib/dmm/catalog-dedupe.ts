import type { DmmItem } from "@/lib/dmm/types";
import {
  dedupeCatalogWorks as dedupeCatalogWorksCore,
  getWorkMatchKeys,
  hasWorkIdentity,
  normalizeWorkId,
  scoreCatalogWork,
} from "@/lib/dmm/catalog-dedupe-core.mjs";

export type CatalogDedupeGroup = {
  indices: number[];
  contentId: string;
  productId: string;
  title: string;
  keepIndex: number;
  removeIndices: number[];
};

export type CatalogDedupeStats = {
  originalCount: number;
  dedupedCount: number;
  duplicateGroups: number;
  removedCount: number;
  mergedCount: number;
  groups: CatalogDedupeGroup[];
};

export { normalizeWorkId, scoreCatalogWork };

export function buildCatalogIdSet(works: DmmItem[]): Set<string> {
  const ids = new Set<string>();

  for (const work of works) {
    for (const key of getWorkMatchKeys(work as Record<string, unknown>)) {
      ids.add(key);
    }
  }

  return ids;
}

export function workMatchesCatalogIds(
  work: DmmItem,
  catalogIds: Set<string>,
): boolean {
  if (!hasWorkIdentity(work as Record<string, unknown>)) {
    return false;
  }

  for (const key of getWorkMatchKeys(work as Record<string, unknown>)) {
    if (catalogIds.has(key)) return true;
  }

  return false;
}

export function dedupeCatalogWorks(items: DmmItem[]): {
  items: DmmItem[];
  stats: CatalogDedupeStats;
} {
  const result = dedupeCatalogWorksCore(items as Record<string, unknown>[]);
  return {
    items: result.items as DmmItem[],
    stats: result.stats,
  };
}

/** 表示用の最終防御。品質の高い1件を残し、元の並び順を維持する。 */
export function dedupeWorksForDisplay(items: DmmItem[]): DmmItem[] {
  return dedupeCatalogWorks(items).items;
}
