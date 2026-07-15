import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { getWorkSaleInfo } from "@/lib/dmm/work-sale-info";
import type {
  WorkLiveStatusRow,
  WorkLiveStatusUpsertInput,
} from "@/lib/dmm/work-live-status/types";

function asPriceText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInteger(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n == null) return null;
  return Math.round(n);
}

/** DmmItem → work_live_status 行 */
export function dmmItemToLiveStatusRow(
  item: DmmItem,
  options?: { checkedAt?: string },
): WorkLiveStatusUpsertInput | null {
  const cid = normalizeCatalogContentId(item.content_id);
  if (!cid) return null;

  const now = options?.checkedAt ?? new Date().toISOString();
  const sale = getWorkSaleInfo(item);
  const rating = asFiniteNumber(item.review?.average);
  const reviewCount = asInteger(item.review?.count);
  const isAvailable =
    item.isActive !== false &&
    item.availabilityStatus !== "unavailable" &&
    item.availability !== "unavailable";

  return {
    cid,
    price: asPriceText(item.prices?.price ?? item.salePrice),
    list_price: asPriceText(item.prices?.list_price ?? item.regularPrice),
    discount_rate: sale.discountRate ?? asInteger(item.discountRate),
    is_sale: sale.isSale || item.saleStatus === "on_sale",
    sale_end_at: sale.saleEndAt ?? item.saleEndAt ?? null,
    rating,
    review_count: reviewCount,
    popularity_rank: asInteger(item.sourcePopularityRank),
    new_arrival_rank: null,
    is_available: isAvailable,
    fanza_tv_status: null,
    checked_at: now,
    updated_at: now,
  };
}

/** work_live_status を DmmItem の変動フィールドへマージ（無い項目は既存値を維持） */
export function applyLiveStatusToItem(
  item: DmmItem,
  row: WorkLiveStatusRow | null | undefined,
): DmmItem {
  if (!row) return item;

  const next: DmmItem = { ...item };

  if (row.price != null || row.list_price != null) {
    next.prices = {
      ...item.prices,
      ...(row.price != null ? { price: row.price } : {}),
      ...(row.list_price != null ? { list_price: row.list_price } : {}),
    };
  }

  if (row.discount_rate != null) {
    next.discountRate = row.discount_rate;
  }

  if (row.is_sale) {
    next.saleStatus = "on_sale";
    if (row.price != null) {
      const parsed = Number(String(row.price).replace(/[^\d]/g, ""));
      next.salePrice = Number.isFinite(parsed) ? parsed : item.salePrice;
    }
    if (row.list_price != null) {
      const parsed = Number(String(row.list_price).replace(/[^\d]/g, ""));
      next.regularPrice = Number.isFinite(parsed) ? parsed : item.regularPrice;
    }
  } else if (row.price != null || row.list_price != null) {
    next.saleStatus = "normal";
    next.salePrice = null;
  }

  if (row.sale_end_at !== undefined) {
    next.saleEndAt = row.sale_end_at;
  }

  if (row.rating != null || row.review_count != null) {
    next.review = {
      ...item.review,
      ...(row.rating != null ? { average: String(row.rating) } : {}),
      ...(row.review_count != null ? { count: row.review_count } : {}),
    };
  }

  if (row.popularity_rank != null) {
    next.sourcePopularityRank = row.popularity_rank;
  }

  if (!row.is_available) {
    next.isActive = false;
    next.availabilityStatus = "unavailable";
    next.availability = "unavailable";
  } else if (item.availabilityStatus === "unavailable" || item.isActive === false) {
    // DB が available なら公開側へ戻す
    next.isActive = true;
    next.availabilityStatus = "available";
    next.availability = "available";
  }

  if (row.checked_at) {
    next.lastSyncedAt = row.checked_at;
  }

  return next;
}

export function liveStatusRowsEqual(
  a: WorkLiveStatusUpsertInput,
  b: WorkLiveStatusRow | null | undefined,
): boolean {
  if (!b) return false;
  return (
    a.cid === b.cid &&
    a.price === b.price &&
    a.list_price === b.list_price &&
    a.discount_rate === b.discount_rate &&
    a.is_sale === b.is_sale &&
    a.sale_end_at === b.sale_end_at &&
    a.rating === b.rating &&
    a.review_count === b.review_count &&
    a.popularity_rank === b.popularity_rank &&
    a.new_arrival_rank === b.new_arrival_rank &&
    a.is_available === b.is_available &&
    a.fanza_tv_status === b.fanza_tv_status
  );
}
