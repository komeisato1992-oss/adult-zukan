export const DOUJIN_PLACEHOLDER_IMAGE = "/images/doujin-placeholder.svg";

export function formatDoujinPrice(price?: number | null): string | undefined {
  if (price == null || Number.isNaN(price)) return undefined;
  return `¥${price.toLocaleString("ja-JP")}`;
}

/**
 * セール割引率（整数%）。通常価格 > 現在価格のときのみ。
 * DBの discountRate が有効なら優先し、なければ価格から計算。
 * 0% / 100%以上 / 計算不能は null。
 */
export function getDoujinDiscountPercent(work: {
  price?: number | null;
  originalPrice?: number | null;
  discountRate?: number | null;
}): number | null {
  const listPrice = work.originalPrice;
  const price = work.price;

  if (
    listPrice == null ||
    price == null ||
    !Number.isFinite(listPrice) ||
    !Number.isFinite(price) ||
    listPrice <= 0 ||
    price <= 0 ||
    listPrice <= price
  ) {
    return null;
  }

  const stored = work.discountRate;
  if (
    typeof stored === "number" &&
    Number.isFinite(stored) &&
    stored > 0 &&
    stored < 100
  ) {
    return Math.round(stored);
  }

  const rate = Math.round(((listPrice - price) / listPrice) * 100);
  if (rate <= 0 || rate >= 100) return null;
  return rate;
}
