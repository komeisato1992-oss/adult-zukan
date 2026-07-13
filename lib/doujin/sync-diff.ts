import "server-only";

import type { DoujinStoredWork, NormalizedDoujinApiItem } from "@/lib/doujin/types";
import {
  DOUJIN_SYNC_LIGHT_FIELDS,
  DOUJIN_SYNC_MODE_FULL,
  DOUJIN_SYNC_MODE_LIGHT,
  type DoujinSyncMode,
} from "@/lib/doujin/sync-mode";

/** raw 比較から除外する揮発キー */
const RAW_VOLATILE_KEYS = new Set([
  "URL",
  "affiliateURL",
  "date",
  "timestamp",
  "fetchedAt",
  "request_id",
  "requestId",
]);

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (RAW_VOLATILE_KEYS.has(key)) continue;
      out[key] = sortKeys(record[key]);
    }
    return out;
  }
  return value;
}

export function sanitizeRawForCompare(
  raw: Record<string, unknown> | undefined | null,
): unknown {
  if (!raw) return null;
  return sortKeys(raw);
}

export function lightFieldsFromNormalized(
  item: NormalizedDoujinApiItem,
  popularityRank?: number,
): Pick<
  DoujinStoredWork,
  | "price"
  | "originalPrice"
  | "discountRate"
  | "isSale"
  | "saleEndAt"
  | "rating"
  | "reviewCount"
> & { currentPopularRank?: number } {
  return {
    price: item.price,
    originalPrice: item.originalPrice,
    discountRate: item.discountRate,
    isSale: item.isSale,
    saleEndAt: item.saleEndAt,
    rating: item.rating,
    reviewCount: item.reviewCount,
    ...(popularityRank != null
      ? { currentPopularRank: popularityRank }
      : {}),
  };
}

export function hasLightFieldDiff(
  existing: DoujinStoredWork,
  next: ReturnType<typeof lightFieldsFromNormalized>,
): boolean {
  const keys: Array<keyof typeof next> = [
    "price",
    "originalPrice",
    "discountRate",
    "isSale",
    "saleEndAt",
    "rating",
    "reviewCount",
  ];
  for (const key of keys) {
    if (existing[key] !== next[key]) return true;
  }
  if (
    next.currentPopularRank !== undefined &&
    existing.currentPopularRank !== next.currentPopularRank
  ) {
    return true;
  }
  return false;
}

export function changedLightFields(
  existing: DoujinStoredWork,
  next: ReturnType<typeof lightFieldsFromNormalized>,
): string[] {
  const changed: string[] = [];
  const keys = [
    "price",
    "originalPrice",
    "discountRate",
    "isSale",
    "saleEndAt",
    "rating",
    "reviewCount",
  ] as const;
  for (const key of keys) {
    if (existing[key] !== next[key]) changed.push(key);
  }
  if (
    next.currentPopularRank !== undefined &&
    existing.currentPopularRank !== next.currentPopularRank
  ) {
    changed.push("currentPopularRank");
  }
  return changed;
}

/** 完全同期向けの主要表示フィールド差分 */
export function hasFullDisplayDiff(
  existing: DoujinStoredWork,
  next: DoujinStoredWork,
): boolean {
  const keys: (keyof DoujinStoredWork)[] = [
    "title",
    "description",
    "affiliateUrl",
    "productUrl",
    "imageSmallUrl",
    "imageListUrl",
    "imageLargeUrl",
    "price",
    "originalPrice",
    "discountRate",
    "isSale",
    "saleEndAt",
    "releaseDate",
    "rating",
    "reviewCount",
    "productFormat",
    "productFormatNormalized",
    "volume",
    "pageCount",
    "seriesId",
    "currentPopularRank",
  ];
  for (const key of keys) {
    if (existing[key] !== next[key]) return true;
  }
  if (
    JSON.stringify(existing.sampleImageUrls) !==
    JSON.stringify(next.sampleImageUrls)
  ) {
    return true;
  }
  if (JSON.stringify(existing.circleIds) !== JSON.stringify(next.circleIds)) {
    return true;
  }
  if (JSON.stringify(existing.authorIds) !== JSON.stringify(next.authorIds)) {
    return true;
  }
  if (JSON.stringify(existing.genreIds) !== JSON.stringify(next.genreIds)) {
    return true;
  }
  return false;
}

export function hasRawDiff(
  prev: Record<string, unknown> | undefined | null,
  next: Record<string, unknown> | undefined | null,
): boolean {
  return (
    stableStringify(sanitizeRawForCompare(prev)) !==
    stableStringify(sanitizeRawForCompare(next))
  );
}

export function syncModeLabel(mode: DoujinSyncMode): string {
  return mode === DOUJIN_SYNC_MODE_LIGHT ? "軽量同期" : "完全同期";
}

export function expectedUpdateFields(mode: DoujinSyncMode): string[] {
  if (mode === DOUJIN_SYNC_MODE_LIGHT) {
    return [...DOUJIN_SYNC_LIGHT_FIELDS, "lastFetchedAt"];
  }
  return [
    "title",
    "description",
    "price",
    "originalPrice",
    "discountRate",
    "isSale",
    "saleEndAt",
    "rating",
    "reviewCount",
    "images",
    "sampleImageUrls",
    "circles",
    "authors",
    "series",
    "genres",
    "productFormat",
    "releaseDate",
    "affiliateUrl",
    "rawApiResponse",
    "lastFetchedAt",
  ];
}

export { DOUJIN_SYNC_MODE_LIGHT, DOUJIN_SYNC_MODE_FULL };
