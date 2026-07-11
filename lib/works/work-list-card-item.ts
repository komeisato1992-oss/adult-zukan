import "server-only";

import {
  getDmmItemActressNameList,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import { getWorkSaleInfo } from "@/lib/dmm/work-sale-info";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

export type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

export function toWorkListCardItem(
  item: DmmItem,
  options: { includeSaleInfo?: boolean } = {},
): WorkListCardItem | null {
  const imageUrl = getDmmListItemImageUrl(item);
  if (!hasValidImage(item) || !imageUrl) {
    return null;
  }

  const sale = getWorkSaleInfo(item);
  const saleInfo = sale.isSale
    ? {
        regularPrice: sale.regularPrice ?? 0,
        currentPrice: sale.currentPrice ?? 0,
        discountRate: sale.discountRate ?? 0,
      }
    : null;

  return {
    contentId: item.content_id,
    title: item.title,
    imageUrl,
    actressNames: getDmmItemActressNameList(item),
    displayPrice: item.prices?.price
      ? formatDmmPriceString(item.prices.price)
      : undefined,
    originalPrice:
      saleInfo && item.prices?.list_price
        ? formatDmmPriceString(item.prices.list_price)
        : undefined,
    isOnSale: saleInfo !== null,
    saleInfo: options.includeSaleInfo && saleInfo ? saleInfo : undefined,
    releaseDate: item.date?.trim() || undefined,
    fanzaUrl: getDmmFanzaUrl(item),
  };
}

export function toWorkListCardItems(
  items: DmmItem[],
  options: { includeSaleInfo?: boolean } = {},
): WorkListCardItem[] {
  const result: WorkListCardItem[] = [];

  for (const item of items) {
    const card = toWorkListCardItem(item, options);
    if (card) {
      result.push(card);
    }
  }

  return result;
}

/** JSON-LD 用に上位件数だけ URL を返す */
export function toWorkListJsonLdEntries(
  items: WorkListCardItem[],
  limit = 20,
): Array<{ name: string; url: string }> {
  return items.slice(0, limit).map((item) => ({
    name: item.title,
    url: `/works/${item.contentId}`,
  }));
}
