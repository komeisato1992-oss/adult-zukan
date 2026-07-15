import "server-only";

import {
  ADULT_SYNC_DATE_FIELDS,
  ADULT_SYNC_LIGHT_FIELDS,
  ADULT_SYNC_MODE_DATE,
  ADULT_SYNC_MODE_PRICE,
  ADULT_SYNC_MODE_RANK,
  ADULT_SYNC_PRICE_FIELDS,
  ADULT_SYNC_RANK_FIELDS,
  getAdultSyncFieldsForMode,
  isAdultPartialSyncMode,
  type AdultSyncMode,
} from "@/lib/dmm/sync-mode";
import type { DmmItem } from "@/lib/dmm/types";

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function pickAdultLightFields(
  item: DmmItem,
): Pick<DmmItem, (typeof ADULT_SYNC_LIGHT_FIELDS)[number]> {
  return {
    prices: item.prices,
    salePrice: item.salePrice,
    regularPrice: item.regularPrice,
    discountRate: item.discountRate,
    saleStatus: item.saleStatus,
    saleEndAt: item.saleEndAt,
    campaign: item.campaign,
    review: item.review,
    sourcePopularityRank: item.sourcePopularityRank,
  };
}

export function pickAdultSyncFields(
  item: DmmItem,
  mode: AdultSyncMode,
): Partial<DmmItem> {
  if (mode === ADULT_SYNC_MODE_PRICE) {
    return {
      prices: item.prices,
      salePrice: item.salePrice,
      regularPrice: item.regularPrice,
      discountRate: item.discountRate,
      saleStatus: item.saleStatus,
      saleEndAt: item.saleEndAt,
      campaign: item.campaign,
    };
  }
  if (mode === ADULT_SYNC_MODE_RANK) {
    return { sourcePopularityRank: item.sourcePopularityRank };
  }
  if (mode === ADULT_SYNC_MODE_DATE) {
    return { date: item.date };
  }
  return pickAdultLightFields(item);
}

export function hasAdultLightFieldDiff(
  existing: DmmItem,
  next: ReturnType<typeof pickAdultLightFields>,
): boolean {
  for (const key of ADULT_SYNC_LIGHT_FIELDS) {
    if (stableJson(existing[key]) !== stableJson(next[key])) return true;
  }
  return false;
}

export function hasAdultSyncFieldDiff(
  existing: DmmItem,
  next: Partial<DmmItem>,
  mode: AdultSyncMode,
): boolean {
  const keys = getAdultSyncFieldsForMode(mode);
  for (const key of keys) {
    const k = key as keyof DmmItem;
    if (stableJson(existing[k]) !== stableJson(next[k])) return true;
  }
  return false;
}

/** 軽量同期で触ってはいけない保護フィールド */
export const ADULT_SYNC_PROTECTED_FIELDS = [
  "title",
  "description",
  "comment",
  "imageURL",
  "sampleImageURL",
  "sampleMovieURL",
  "iteminfo",
  "actress",
  "maker",
  "label",
  "series",
  "date",
  "URL",
  "affiliateURL",
] as const;

export function expectedAdultUpdateFields(mode: AdultSyncMode): string[] {
  if (isAdultPartialSyncMode(mode)) {
    if (mode === ADULT_SYNC_MODE_PRICE) return [...ADULT_SYNC_PRICE_FIELDS];
    if (mode === ADULT_SYNC_MODE_RANK) return [...ADULT_SYNC_RANK_FIELDS];
    if (mode === ADULT_SYNC_MODE_DATE) return [...ADULT_SYNC_DATE_FIELDS];
    return [...ADULT_SYNC_LIGHT_FIELDS];
  }
  return [
    "title",
    "description",
    "prices",
    "imageURL",
    "sampleImageURL",
    "sampleMovieURL",
    "iteminfo",
    "actress",
    "maker",
    "label",
    "series",
    "date",
    "URL",
    "affiliateURL",
    "review",
    "campaign",
    ...ADULT_SYNC_LIGHT_FIELDS,
  ];
}
