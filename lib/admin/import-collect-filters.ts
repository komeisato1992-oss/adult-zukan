import "server-only";

import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import type { ImportCollectExclusionStats } from "@/lib/admin/import-collect-types";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { getValidImageUrl } from "@/lib/works";

export type ImportCollectBlockContext = {
  catalogIds: Set<string>;
  catalogProductIds: Set<string>;
  addedIds: Set<string>;
  excludedIds: Set<string>;
  pendingIds: Set<string>;
  batchIds: Set<string>;
  batchProductIds: Set<string>;
};

export type ImportCollectRejectReason =
  | "catalogPublished"
  | "alreadyAdded"
  | "alreadyExcluded"
  | "alreadyPending"
  | "duplicate"
  | "noImage"
  | "invalid";

export function createImportCollectBlockContext(
  catalogIds: Set<string>,
  catalogProductIds: Set<string>,
  records: StoredImportCandidate[],
): ImportCollectBlockContext {
  const addedIds = new Set<string>();
  const excludedIds = new Set<string>();
  const pendingIds = new Set<string>();

  for (const record of records) {
    const id = normalizeImportContentId(record.content_id);
    if (!id) continue;

    if (record.status === "added") {
      addedIds.add(id);
    } else if (record.status === "excluded") {
      excludedIds.add(id);
    } else {
      pendingIds.add(id);
    }

    const productId = normalizeImportContentId(record.item?.product_id ?? "");
    if (productId) {
      if (record.status === "added") addedIds.add(productId);
      else if (record.status === "excluded") excludedIds.add(productId);
      else pendingIds.add(productId);
    }
  }

  return {
    catalogIds,
    catalogProductIds,
    addedIds,
    excludedIds,
    pendingIds,
    batchIds: new Set<string>(),
    batchProductIds: new Set<string>(),
  };
}

function getItemIdentityKeys(item: DmmItem): string[] {
  const keys = new Set<string>();
  const contentId = normalizeImportContentId(item.content_id);
  const productId = normalizeImportContentId(item.product_id ?? "");

  if (contentId) keys.add(contentId);
  if (productId) keys.add(productId);

  return [...keys];
}

function isKnownInCatalog(keys: string[], context: ImportCollectBlockContext): boolean {
  return keys.some(
    (key) => context.catalogIds.has(key) || context.catalogProductIds.has(key),
  );
}

function isKnownAdded(keys: string[], context: ImportCollectBlockContext): boolean {
  return keys.some((key) => context.addedIds.has(key));
}

function isKnownExcluded(
  keys: string[],
  context: ImportCollectBlockContext,
): boolean {
  return keys.some((key) => context.excludedIds.has(key));
}

function isKnownPending(
  keys: string[],
  context: ImportCollectBlockContext,
): boolean {
  return keys.some((key) => context.pendingIds.has(key));
}

function isDuplicateInBatch(
  keys: string[],
  context: ImportCollectBlockContext,
): boolean {
  return keys.some(
    (key) => context.batchIds.has(key) || context.batchProductIds.has(key),
  );
}

function markBatchIds(item: DmmItem, context: ImportCollectBlockContext): void {
  const contentId = normalizeImportContentId(item.content_id);
  const productId = normalizeImportContentId(item.product_id ?? "");

  if (contentId) context.batchIds.add(contentId);
  if (productId) context.batchProductIds.add(productId);
}

export function hasCollectibleImage(item: DmmItem): boolean {
  return Boolean(getValidImageUrl(item, ["large", "list", "small"]));
}

export function classifyImportCollectItem(
  item: DmmItem,
  context: ImportCollectBlockContext,
): ImportCollectRejectReason | null {
  const keys = getItemIdentityKeys(item);
  if (keys.length === 0) return "invalid";

  if (isKnownInCatalog(keys, context)) return "catalogPublished";
  if (isKnownAdded(keys, context)) return "alreadyAdded";
  if (isKnownExcluded(keys, context)) return "alreadyExcluded";
  if (isKnownPending(keys, context)) return "alreadyPending";
  if (isDuplicateInBatch(keys, context)) return "duplicate";
  if (!hasCollectibleImage(item)) return "noImage";
  if (!isValidDmmListItem(item)) return "invalid";

  return null;
}

export function createEmptyExclusionStats(): ImportCollectExclusionStats {
  return {
    catalogPublished: 0,
    alreadyAdded: 0,
    alreadyExcluded: 0,
    alreadyPending: 0,
    noImage: 0,
    invalid: 0,
    duplicate: 0,
  };
}

export function recordExclusion(
  stats: ImportCollectExclusionStats,
  reason: ImportCollectRejectReason,
): void {
  switch (reason) {
    case "catalogPublished":
      stats.catalogPublished += 1;
      break;
    case "alreadyAdded":
      stats.alreadyAdded += 1;
      break;
    case "alreadyExcluded":
      stats.alreadyExcluded += 1;
      break;
    case "alreadyPending":
      stats.alreadyPending += 1;
      break;
    case "noImage":
      stats.noImage += 1;
      break;
    case "invalid":
      stats.invalid += 1;
      break;
    case "duplicate":
      stats.duplicate += 1;
      break;
    default:
      break;
  }
}

export function acceptImportCollectItem(
  item: DmmItem,
  context: ImportCollectBlockContext,
  stats: ImportCollectExclusionStats,
): boolean {
  const reason = classifyImportCollectItem(item, context);
  if (reason) {
    recordExclusion(stats, reason);
    return false;
  }

  markBatchIds(item, context);
  return true;
}

export function getExistingCatalogIdSets(): {
  catalogIds: Set<string>;
  catalogProductIds: Set<string>;
} {
  const catalogIds = new Set<string>();
  const catalogProductIds = new Set<string>();

  for (const item of readCatalogSnapshot()) {
    const contentId = normalizeImportContentId(item.content_id);
    const productId = normalizeImportContentId(item.product_id ?? "");

    if (contentId) catalogIds.add(contentId);
    if (productId) catalogProductIds.add(productId);
  }

  return { catalogIds, catalogProductIds };
}
