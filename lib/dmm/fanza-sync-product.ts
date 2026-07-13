import "server-only";

import {
  FANZA_NOT_FOUND_HIDE_THRESHOLD,
  FANZA_UNAVAILABLE_HIDE_AFTER_MS,
  getConsecutiveNotFoundCount,
} from "@/lib/dmm/catalog-visibility";
import { pickRefreshableFields } from "@/lib/dmm/catalog-refresh-fields";
import {
  FanzaApiTransportError,
  FanzaProductNotFoundError,
  fetchFanzaProductItem,
} from "@/lib/dmm/fanza-sync-client";
import {
  hasAdultLightFieldDiff,
  pickAdultLightFields,
} from "@/lib/dmm/sync-diff";
import {
  ADULT_SYNC_MODE_FULL,
  ADULT_SYNC_MODE_LIGHT,
  type AdultSyncMode,
} from "@/lib/dmm/sync-mode";
import type { DmmItem } from "@/lib/dmm/types";
import { getWorkSaleInfo } from "@/lib/dmm/work-sale-info";

export type FanzaSyncProductResult = {
  work: DmmItem;
  outcome:
    | "updated"
    | "unchanged"
    | "not_found"
    | "transport_error"
    | "hidden"
    | "republished";
  priceChanged: boolean;
  saleStarted: boolean;
  saleEnded: boolean;
  hidden: boolean;
  republished: boolean;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function applySaleFields(work: DmmItem): DmmItem {
  const sale = getWorkSaleInfo(work);

  if (sale.isSale && sale.regularPrice && sale.currentPrice && sale.discountRate) {
    return {
      ...work,
      saleStatus: "on_sale",
      salePrice: sale.currentPrice,
      regularPrice: sale.regularPrice,
      discountRate: sale.discountRate,
      saleEndAt: sale.saleEndAt,
    };
  }

  return {
    ...work,
    saleStatus: "normal",
    salePrice: null,
    discountRate: null,
    regularPrice: sale.regularPrice,
    saleEndAt: null,
  };
}

function mergeNonEmptyFields(existing: DmmItem, apiItem: DmmItem): DmmItem {
  const refreshable = pickRefreshableFields(apiItem);
  const merged: DmmItem = { ...existing };

  for (const [key, value] of Object.entries(refreshable)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (merged as Record<string, unknown>)[key] = value;
  }

  if (hasText(apiItem.title)) {
    merged.title = apiItem.title.trim();
  }

  return merged;
}

function markTransportError(existing: DmmItem, message: string): DmmItem {
  const now = new Date().toISOString();
  return {
    ...existing,
    lastSyncAttemptAt: now,
    syncErrorMessage: message.slice(0, 500),
    // 揮発エラー記録はカタログ全体の差分にしないため updatedAt は据え置き
  };
}

function markNotFound(existing: DmmItem): {
  work: DmmItem;
  hidden: boolean;
} {
  const now = new Date().toISOString();
  const count = getConsecutiveNotFoundCount(existing) + 1;
  const detectedAt = existing.unavailableDetectedAt ?? now;
  const elapsed = Date.now() - Date.parse(detectedAt);
  const shouldHide =
    count >= FANZA_NOT_FOUND_HIDE_THRESHOLD &&
    elapsed >= FANZA_UNAVAILABLE_HIDE_AFTER_MS;

  const wasHidden = existing.isActive === false;

  const work: DmmItem = {
    ...existing,
    consecutiveNotFoundCount: count,
    consecutiveFetchFailures: count,
    unavailableDetectedAt: detectedAt,
    availabilityStatus: shouldHide ? "unavailable" : "temporarily_unconfirmed",
    availability: shouldHide ? "unavailable" : existing.availability,
    isActive: shouldHide ? false : true,
    hiddenReason: shouldHide ? "fanza_unavailable" : existing.hiddenReason,
    lastSyncAttemptAt: now,
    syncErrorMessage: null,
    updatedAt: shouldHide ? now : existing.updatedAt,
    ...(shouldHide
      ? {
          saleStatus: "normal" as const,
          salePrice: null,
          discountRate: null,
        }
      : {}),
  };

  return {
    work,
    hidden: shouldHide && !wasHidden,
  };
}

function markSuccessLight(
  existing: DmmItem,
  apiItem: DmmItem,
): FanzaSyncProductResult {
  const now = new Date().toISOString();
  const beforeSale = getWorkSaleInfo(existing);
  const withSale = applySaleFields({
    ...existing,
    prices: apiItem.prices ?? existing.prices,
    campaign: apiItem.campaign ?? existing.campaign,
    review: apiItem.review ?? existing.review,
  });
  const light = pickAdultLightFields(withSale);
  const afterSale = getWorkSaleInfo(withSale);
  const priceChanged =
    JSON.stringify(existing.prices) !== JSON.stringify(withSale.prices);
  const saleStarted = !beforeSale.isSale && afterSale.isSale;
  const saleEnded = beforeSale.isSale && !afterSale.isSale;
  const lightChanged = hasAdultLightFieldDiff(existing, light);

  if (!lightChanged && !saleStarted && !saleEnded) {
    return {
      work: existing,
      outcome: "unchanged",
      priceChanged: false,
      saleStarted: false,
      saleEnded: false,
      hidden: false,
      republished: false,
    };
  }

  const work: DmmItem = {
    ...existing,
    ...light,
    priceUpdatedAt: priceChanged ? now : existing.priceUpdatedAt,
    saleUpdatedAt: saleStarted || saleEnded ? now : existing.saleUpdatedAt,
    lastSyncedAt: now,
    updatedAt: now,
  };

  return {
    work,
    outcome: "updated",
    priceChanged,
    saleStarted,
    saleEnded,
    hidden: false,
    republished: false,
  };
}

function markSuccessFull(
  existing: DmmItem,
  apiItem: DmmItem,
): FanzaSyncProductResult {
  const now = new Date().toISOString();
  const beforeSale = getWorkSaleInfo(existing);
  const mergedBase = mergeNonEmptyFields(existing, apiItem);
  const withSale = applySaleFields(mergedBase);
  const afterSale = getWorkSaleInfo(withSale);
  const priceChanged =
    JSON.stringify(existing.prices) !== JSON.stringify(withSale.prices);
  const saleStarted = !beforeSale.isSale && afterSale.isSale;
  const saleEnded = beforeSale.isSale && !afterSale.isSale;
  const wasHidden =
    existing.isActive === false || existing.hiddenReason === "fanza_unavailable";
  const republished = wasHidden;

  const candidate: DmmItem = {
    ...withSale,
    content_id: existing.content_id,
    product_id: existing.product_id,
    description: existing.description ?? withSale.description,
    comment: existing.comment,
    addedAt: existing.addedAt,
    importedAt: existing.importedAt,
    sourcePopularityRank:
      apiItem.sourcePopularityRank ?? existing.sourcePopularityRank,
    popularityUpdatedAt:
      apiItem.sourcePopularityRank != null &&
      apiItem.sourcePopularityRank !== existing.sourcePopularityRank
        ? now
        : existing.popularityUpdatedAt,
    isActive: true,
    availabilityStatus: "available",
    availability: "available",
    consecutiveNotFoundCount: 0,
    consecutiveFetchFailures: 0,
    unavailableDetectedAt: undefined,
    unavailableCheckedAt: undefined,
    hiddenReason:
      existing.hiddenReason === "fanza_unavailable" ? null : existing.hiddenReason,
    syncErrorMessage: null,
    priceUpdatedAt: priceChanged ? now : existing.priceUpdatedAt,
    saleUpdatedAt: saleStarted || saleEnded ? now : existing.saleUpdatedAt,
  };

  // タイムスタンプを除いて実データ差分を判定
  const existingComparable = {
    ...existing,
    lastSyncedAt: undefined,
    lastSyncAttemptAt: undefined,
    lastRefreshedAt: undefined,
    updatedAt: undefined,
  };
  const candidateComparable = {
    ...candidate,
    lastSyncedAt: undefined,
    lastSyncAttemptAt: undefined,
    lastRefreshedAt: undefined,
    updatedAt: undefined,
  };
  const dataChanged =
    priceChanged ||
    saleStarted ||
    saleEnded ||
    republished ||
    JSON.stringify(existingComparable) !== JSON.stringify(candidateComparable);

  if (!dataChanged) {
    return {
      work: existing,
      outcome: "unchanged",
      priceChanged: false,
      saleStarted: false,
      saleEnded: false,
      hidden: false,
      republished: false,
    };
  }

  const work: DmmItem = {
    ...candidate,
    lastSyncedAt: now,
    lastRefreshedAt: now,
    updatedAt: now,
  };

  return {
    work,
    outcome: republished ? "republished" : "updated",
    priceChanged,
    saleStarted,
    saleEnded,
    hidden: false,
    republished,
  };
}

function markSuccess(
  existing: DmmItem,
  apiItem: DmmItem,
  mode: AdultSyncMode,
): FanzaSyncProductResult {
  return mode === ADULT_SYNC_MODE_LIGHT
    ? markSuccessLight(existing, apiItem)
    : markSuccessFull(existing, apiItem);
}

/** 掲載済み作品1件を FANZA API と同期 */
export async function syncFanzaProduct(
  existing: DmmItem,
  options?: { mode?: AdultSyncMode },
): Promise<FanzaSyncProductResult> {
  const mode = options?.mode ?? ADULT_SYNC_MODE_FULL;
  const contentId = existing.content_id?.trim();
  if (!contentId) {
    return {
      work: markTransportError(existing, "content_id が空です"),
      outcome: "transport_error",
      priceChanged: false,
      saleStarted: false,
      saleEnded: false,
      hidden: false,
      republished: false,
    };
  }

  try {
    const apiItem = await fetchFanzaProductItem(contentId);
    return markSuccess(existing, apiItem, mode);
  } catch (error) {
    if (error instanceof FanzaProductNotFoundError) {
      const { work, hidden } = markNotFound(existing);
      return {
        work,
        outcome: hidden ? "hidden" : "not_found",
        priceChanged: false,
        saleStarted: false,
        saleEnded: false,
        hidden,
        republished: false,
      };
    }

    if (error instanceof FanzaApiTransportError) {
      return {
        work: markTransportError(existing, error.message),
        outcome: "transport_error",
        priceChanged: false,
        saleStarted: false,
        saleEnded: false,
        hidden: false,
        republished: false,
      };
    }

    return {
      work: markTransportError(
        existing,
        error instanceof Error ? error.message : "同期エラー",
      ),
      outcome: "transport_error",
      priceChanged: false,
      saleStarted: false,
      saleEnded: false,
      hidden: false,
      republished: false,
    };
  }
}
