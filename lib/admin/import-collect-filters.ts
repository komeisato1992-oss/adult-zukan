import "server-only";

import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import {
  buildWorkIdentityKeys,
  keysMatchAny,
} from "@/lib/admin/import-identity";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import type { ImportCollectExclusionStats } from "@/lib/admin/import-collect-types";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { getValidImageUrl } from "@/lib/works";

export type ImportCollectBlockContext = {
  catalogKeys: Set<string>;
  addedKeys: Set<string>;
  excludedKeys: Set<string>;
  pendingKeys: Set<string>;
  fetchedKeys: Set<string>;
  batchKeys: Set<string>;
};

export type ImportCollectRejectReason =
  | "catalogPublished"
  | "alreadyAdded"
  | "alreadyExcluded"
  | "alreadyPending"
  | "alreadyFetched"
  | "duplicate"
  | "noImage"
  | "invalid";

function addRecordKeys(
  target: Set<string>,
  record: StoredImportCandidate,
): void {
  const identity = buildWorkIdentityKeys({
    content_id: record.content_id,
    product_id: record.item?.product_id ?? record.content_id,
    URL: record.item?.URL ?? "",
    title: record.title || record.item?.title || "",
  });

  for (const key of identity.allKeys) {
    target.add(key);
  }
}

export function createImportCollectBlockContext(
  catalogKeys: Set<string>,
  records: StoredImportCandidate[],
  fetchedKeys: Set<string>,
): ImportCollectBlockContext {
  const addedKeys = new Set<string>();
  const excludedKeys = new Set<string>();
  const pendingKeys = new Set<string>();

  for (const record of records) {
    if (record.status === "added") {
      addRecordKeys(addedKeys, record);
    } else if (record.status === "excluded") {
      addRecordKeys(excludedKeys, record);
    } else {
      addRecordKeys(pendingKeys, record);
    }
  }

  return {
    catalogKeys,
    addedKeys,
    excludedKeys,
    pendingKeys,
    fetchedKeys,
    batchKeys: new Set<string>(),
  };
}

export function hasCollectibleImage(item: DmmItem): boolean {
  return Boolean(getValidImageUrl(item, ["large", "list", "small"]));
}

export function classifyImportCollectItem(
  item: DmmItem,
  context: ImportCollectBlockContext,
): ImportCollectRejectReason | null {
  const identity = buildWorkIdentityKeys(item);
  if (!identity.contentId && !identity.productId) return "invalid";

  if (keysMatchAny(identity.allKeys, context.catalogKeys)) {
    return "catalogPublished";
  }
  if (keysMatchAny(identity.allKeys, context.addedKeys)) {
    return "alreadyAdded";
  }
  if (keysMatchAny(identity.allKeys, context.excludedKeys)) {
    return "alreadyExcluded";
  }
  if (keysMatchAny(identity.allKeys, context.pendingKeys)) {
    return "alreadyPending";
  }
  if (keysMatchAny(identity.allKeys, context.fetchedKeys)) {
    return "alreadyFetched";
  }
  if (keysMatchAny(identity.allKeys, context.batchKeys)) {
    return "duplicate";
  }
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
    alreadyFetched: 0,
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
    case "alreadyFetched":
      stats.alreadyFetched += 1;
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

  for (const key of buildWorkIdentityKeys(item).allKeys) {
    context.batchKeys.add(key);
  }
  return true;
}

export function getExistingCatalogKeySet(): Set<string> {
  const catalogKeys = new Set<string>();

  for (const item of readCatalogSnapshot()) {
    const identity = buildWorkIdentityKeys(item);
    for (const key of identity.allKeys) {
      catalogKeys.add(key);
    }
  }

  return catalogKeys;
}

/** @deprecated getExistingCatalogKeySet を使用してください */
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
