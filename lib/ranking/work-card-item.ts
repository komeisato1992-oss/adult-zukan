import "server-only";

import {
  getDmmItemActressNameList,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { hasValidImage } from "@/lib/works";

export type RankingWorkCardItem = {
  contentId: string;
  title: string;
  imageUrl: string;
  actressNames: string[];
  displayPrice?: string;
  originalPrice?: string;
  isOnSale: boolean;
  releaseDate?: string;
  fanzaUrl: string;
};

export function toRankingWorkCardItem(item: DmmItem): RankingWorkCardItem | null {
  const imageUrl = getDmmListItemImageUrl(item);
  if (!hasValidImage(item) || !imageUrl) {
    return null;
  }

  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  const isOnSale = listPrice > 0 && price > 0 && price < listPrice;

  return {
    contentId: item.content_id,
    title: item.title,
    imageUrl,
    actressNames: getDmmItemActressNameList(item),
    displayPrice: item.prices?.price
      ? formatDmmPriceString(item.prices.price)
      : undefined,
    originalPrice:
      isOnSale && item.prices?.list_price
        ? formatDmmPriceString(item.prices.list_price)
        : undefined,
    isOnSale,
    releaseDate: item.date?.trim() || undefined,
    fanzaUrl: getDmmFanzaUrl(item),
  };
}

export function toRankingWorkCardItems(items: DmmItem[]): RankingWorkCardItem[] {
  const result: RankingWorkCardItem[] = [];

  for (const item of items) {
    const card = toRankingWorkCardItem(item);
    if (card) {
      result.push(card);
    }
  }

  return result;
}

/** JSON-LD 用に上位件数だけ URL を返す */
export function toRankingJsonLdEntries(
  items: RankingWorkCardItem[],
  limit = 20,
): Array<{ name: string; url: string }> {
  return items.slice(0, limit).map((item) => ({
    name: item.title,
    url: `/works/${item.contentId}`,
  }));
}
