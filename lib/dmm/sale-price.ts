import type { DmmDelivery, DmmItem } from "@/lib/dmm/types";

export type SalePriceInfo = {
  regularPrice: number;
  currentPrice: number;
  discountRate: number;
};

function isExactComparablePriceString(value?: string | number | null): boolean {
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  return !/[~〜]/.test(raw);
}

/** 価格文字列を比較用の数値へ。取得できない場合は null */
export function parseComparablePrice(
  value?: string | number | null,
): number | null {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(/,/g, "").replace(/[^\d]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseExactComparablePrice(
  value?: string | number | null,
): number | null {
  if (!isExactComparablePriceString(value)) return null;
  return parseComparablePrice(value);
}

export function buildSalePriceInfo(
  regularPrice: number,
  currentPrice: number,
): SalePriceInfo | null {
  if (regularPrice <= 0 || currentPrice <= 0 || currentPrice >= regularPrice) {
    return null;
  }

  const discountRate = Math.round(
    ((regularPrice - currentPrice) / regularPrice) * 100,
  );

  if (discountRate <= 0 || discountRate >= 100) {
    return null;
  }

  return {
    regularPrice,
    currentPrice,
    discountRate,
  };
}

function getDeliverySalePriceInfo(delivery: DmmDelivery): SalePriceInfo | null {
  const regularPrice = parseExactComparablePrice(delivery.list_price);
  const currentPrice = parseExactComparablePrice(delivery.price);

  if (regularPrice == null || currentPrice == null) {
    return null;
  }

  return buildSalePriceInfo(regularPrice, currentPrice);
}

function getTopLevelSalePriceInfo(item: DmmItem): SalePriceInfo | null {
  const regularPrice = parseExactComparablePrice(item.prices?.list_price);
  const currentPrice = parseExactComparablePrice(item.prices?.price);

  if (regularPrice == null || currentPrice == null) {
    return null;
  }

  return buildSalePriceInfo(regularPrice, currentPrice);
}

function getBestDeliverySalePriceInfo(item: DmmItem): SalePriceInfo | null {
  const deliveries = item.prices?.deliveries?.delivery ?? [];
  let best: SalePriceInfo | null = null;

  for (const delivery of deliveries) {
    const info = getDeliverySalePriceInfo(delivery);
    if (!info) continue;

    if (
      !best ||
      info.discountRate > best.discountRate ||
      (info.discountRate === best.discountRate &&
        info.currentPrice < best.currentPrice)
    ) {
      best = info;
    }
  }

  return best;
}

export function getSalePriceInfo(item: DmmItem): SalePriceInfo | null {
  return getTopLevelSalePriceInfo(item) ?? getBestDeliverySalePriceInfo(item);
}

export function getCurrentPrice(item: DmmItem): number | null {
  return getSalePriceInfo(item)?.currentPrice ?? parseComparablePrice(item.prices?.price);
}

export function getRegularPrice(item: DmmItem): number | null {
  return getSalePriceInfo(item)?.regularPrice ?? parseComparablePrice(item.prices?.list_price);
}

export function isDmmItemOnSale(item: DmmItem): boolean {
  return getSalePriceInfo(item) !== null;
}

export function isWorksListSaleQuery(query: {
  sale?: string;
  filter?: string;
}): boolean {
  return (
    query.sale === "1" ||
    query.sale === "true" ||
    query.filter === "sale"
  );
}
