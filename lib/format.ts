import type { AffiliateProvider } from "@/data/types";

const providerLabels: Record<AffiliateProvider, string> = {
  dmm: "DMMで見る",
  fanza: "作品を見る",
  rakuten: "楽天TVで見る",
  sample: "作品を見る",
};

export function getAffiliateLabel(provider: AffiliateProvider): string {
  return providerLabels[provider];
}

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString("ja-JP")}`;
}

export function getDisplayPrice(work: {
  price: number;
  salePrice?: number;
}): { current: number; original?: number; isOnSale: boolean } {
  if (work.salePrice !== undefined && work.salePrice < work.price) {
    return {
      current: work.salePrice,
      original: work.price,
      isOnSale: true,
    };
  }

  return { current: work.price, isOnSale: false };
}
