import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { getWorkSaleInfo } from "@/lib/dmm/work-sale-info";
import { parseComparablePrice } from "@/lib/dmm/sale-price";
import type {
  WorkLiveStatusRow,
  WorkLiveStatusUpsertInput,
} from "@/lib/dmm/work-live-status/types";

function asPriceText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asPriceAmount(value: unknown): number | null {
  return parseComparablePrice(
    value == null ? null : (value as string | number),
  );
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

  const priceText = asPriceText(item.prices?.price ?? item.salePrice);
  const priceAmount = asPriceAmount(priceText ?? item.salePrice);
  const fanzaNewRank = asInteger(item.fanzaNewRank);
  const normalizedNewRank =
    fanzaNewRank != null && fanzaNewRank > 0 ? fanzaNewRank : null;
  return {
    cid,
    price: priceText,
    list_price: asPriceText(item.prices?.list_price ?? item.regularPrice),
    price_amount: priceAmount,
    discount_rate: sale.discountRate ?? asInteger(item.discountRate),
    is_sale: sale.isSale || item.saleStatus === "on_sale",
    sale_start_at: null,
    sale_end_at: sale.saleEndAt ?? item.saleEndAt ?? null,
    rating,
    review_count: reviewCount,
    popularity_rank: asInteger(item.sourcePopularityRank),
    // price_amount 未適用環境の数値ソート用（円）。適用後は price_amount を優先。
    new_arrival_rank: priceAmount,
    fanza_new_rank: normalizedNewRank,
    fanza_new_rank_updated_at:
      normalizedNewRank != null
        ? (item.fanzaNewRankUpdatedAt ?? now)
        : (item.fanzaNewRankUpdatedAt ?? null),
    is_available: isAvailable,
    manual_hidden: item.hiddenReason === "manual",
    fanza_tv_status: null,
    fanza_tv_checked_at: null,
    fanza_tv_changed_at: null,
    fanza_tv_source: null,
    fanza_tv_error: null,
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

  if (row.fanza_new_rank != null && row.fanza_new_rank > 0) {
    next.fanzaNewRank = row.fanza_new_rank;
  }
  if (row.fanza_new_rank_updated_at) {
    next.fanzaNewRankUpdatedAt = row.fanza_new_rank_updated_at;
  }

  if (!row.is_available || row.manual_hidden) {
    next.isActive = false;
    next.availabilityStatus = "unavailable";
    next.availability = "unavailable";
    if (row.manual_hidden) {
      next.hiddenReason = "manual";
    }
  } else if (item.availabilityStatus === "unavailable" || item.isActive === false) {
    // DB が available なら公開側へ戻す
    next.isActive = true;
    next.availabilityStatus = "available";
    next.availability = "available";
  }

  if (row.checked_at) {
    next.lastSyncedAt = row.checked_at;
  }

  const tv = row.fanza_tv_status?.trim().toLowerCase();
  if (tv === "active" || tv === "not_available" || tv === "unknown") {
    next.fanzaTvStatus = tv;
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
    (a.price_amount ?? null) === (b.price_amount ?? null) &&
    a.discount_rate === b.discount_rate &&
    a.is_sale === b.is_sale &&
    (a.sale_start_at ?? null) === (b.sale_start_at ?? null) &&
    a.sale_end_at === b.sale_end_at &&
    a.rating === b.rating &&
    a.review_count === b.review_count &&
    a.popularity_rank === b.popularity_rank &&
    a.new_arrival_rank === b.new_arrival_rank &&
    (a.fanza_new_rank ?? null) === (b.fanza_new_rank ?? null) &&
    a.is_available === b.is_available &&
    Boolean(a.manual_hidden) === Boolean(b.manual_hidden) &&
    a.fanza_tv_status === b.fanza_tv_status
  );
}
