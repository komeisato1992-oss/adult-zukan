import type { RefreshableWorkSnapshot } from "@/lib/dmm/catalog-refresh-types";
import type { DmmItem } from "@/lib/dmm/types";
import { getWorkSaleInfo } from "@/lib/dmm/work-sale-info";

const REFRESHABLE_KEYS = [
  "prices",
  "URL",
  "affiliateURL",
  "imageURL",
  "sampleImageURL",
  "sampleMovieURL",
  "iteminfo",
  "date",
  "volume",
  "review",
  "campaign",
  "maker",
  "label",
  "series",
  "actress",
] as const satisfies ReadonlyArray<keyof RefreshableWorkSnapshot>;

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** API から更新してよいフィールドだけ抽出（title / description 等は含めない） */
export function pickRefreshableFields(apiWork: DmmItem): RefreshableWorkSnapshot {
  const picked: Partial<RefreshableWorkSnapshot> = {};

  for (const key of REFRESHABLE_KEYS) {
    const value = apiWork[key];
    if (value !== undefined) {
      (picked as Record<string, unknown>)[key] = value;
    }
  }

  return picked as RefreshableWorkSnapshot;
}

function pricesEqual(a: DmmItem["prices"], b: DmmItem["prices"]): boolean {
  return stableJson(a) === stableJson(b);
}

export function mergeRefreshedWork(
  existingWork: DmmItem,
  apiWork: DmmItem,
): {
  work: DmmItem;
  priceChanged: boolean;
  saleStarted: boolean;
  saleEnded: boolean;
  availabilityChanged: boolean;
  changed: boolean;
} {
  const refreshable = pickRefreshableFields(apiWork);
  const now = new Date().toISOString();
  const beforeSale = getWorkSaleInfo(existingWork);
  const mergedPreview: DmmItem = {
    ...existingWork,
    ...refreshable,
  };
  const afterSale = getWorkSaleInfo(mergedPreview);

  const priceChanged = !pricesEqual(existingWork.prices, refreshable.prices);
  const saleStarted = !beforeSale.isSale && afterSale.isSale;
  const saleEnded = beforeSale.isSale && !afterSale.isSale;
  const previousAvailability = existingWork.availability ?? "available";
  const nextAvailability: DmmItem["availability"] = "available";
  const availabilityChanged = previousAvailability !== nextAvailability;

  const changed =
    priceChanged ||
    saleStarted ||
    saleEnded ||
    availabilityChanged ||
    REFRESHABLE_KEYS.some(
      (key) =>
        stableJson(existingWork[key]) !== stableJson(refreshable[key]),
    );

  const work: DmmItem = {
    ...existingWork,
    ...refreshable,
    content_id: existingWork.content_id,
    product_id: existingWork.product_id,
    title: existingWork.title,
    description: existingWork.description,
    comment: existingWork.comment,
    addedAt: existingWork.addedAt,
    importedAt: existingWork.importedAt,
    sourcePopularityRank: existingWork.sourcePopularityRank,
    popularityUpdatedAt: existingWork.popularityUpdatedAt,
    availability: nextAvailability,
    consecutiveFetchFailures: 0,
    unavailableCheckedAt: undefined,
    lastRefreshedAt: now,
    updatedAt: now,
    priceUpdatedAt: priceChanged ? now : existingWork.priceUpdatedAt,
    saleUpdatedAt:
      saleStarted || saleEnded ? now : existingWork.saleUpdatedAt,
  };

  return {
    work,
    priceChanged,
    saleStarted,
    saleEnded,
    availabilityChanged,
    changed,
  };
}

export function markWorkUnavailable(
  existingWork: DmmItem,
  reason: string,
): {
  work: DmmItem;
  availabilityChanged: boolean;
} {
  const now = new Date().toISOString();
  const previousAvailability = existingWork.availability ?? "available";
  const failures = (existingWork.consecutiveFetchFailures ?? 0) + 1;

  const work: DmmItem = {
    ...existingWork,
    availability: "unavailable",
    unavailableCheckedAt: now,
    consecutiveFetchFailures: failures,
    lastRefreshedAt: now,
    updatedAt: now,
  };

  return {
    work,
    availabilityChanged: previousAvailability !== "unavailable",
  };
}

export function markWorkFetchFailed(existingWork: DmmItem): DmmItem {
  const now = new Date().toISOString();
  return {
    ...existingWork,
    consecutiveFetchFailures: (existingWork.consecutiveFetchFailures ?? 0) + 1,
    lastRefreshedAt: now,
    updatedAt: now,
  };
}
