import "server-only";

import {
  CATALOG_LEGACY_SNAPSHOT_RELATIVE,
  clearCatalogShardCache,
  getAllCatalogWorks,
  getCatalogFingerprint,
  rewriteAllCatalogShardsLocally,
} from "@/lib/dmm/catalog-shards";
import type { DmmItem } from "@/lib/dmm/types";

/** @deprecated Use CATALOG_MANIFEST_RELATIVE / shard paths. Kept for path checks. */
export const CATALOG_SNAPSHOT_RELATIVE_PATH = CATALOG_LEGACY_SNAPSHOT_RELATIVE;

export function clearCatalogSnapshotCache(): void {
  clearCatalogShardCache();
}

/** ローカルファイルから全カタログ作品を読む（shard 優先、legacy はフォールバック） */
export function readCatalogSnapshot(): DmmItem[] {
  return getAllCatalogWorks();
}

/** 全作品を shard 群へ書き直す（巨大単一 JSON は作らない） */
export function writeCatalogSnapshot(items: DmmItem[]): void {
  rewriteAllCatalogShardsLocally(items);
}

export function normalizeCatalogContentId(value: string): string {
  return value.trim().toLowerCase();
}

export function catalogHasContentId(
  items: DmmItem[],
  contentId: string,
): boolean {
  const normalizedId = normalizeCatalogContentId(contentId);
  return items.some(
    (entry) => normalizeCatalogContentId(entry.content_id) === normalizedId,
  );
}

export function getCatalogSnapshotFingerprint(): string {
  return getCatalogFingerprint();
}

export { CATALOG_LEGACY_SNAPSHOT_RELATIVE };
