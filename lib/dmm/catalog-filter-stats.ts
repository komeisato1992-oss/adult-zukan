import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage, isValidImageUrl } from "@/lib/works";
import { isValidDmmListItem } from "@/lib/dmm/filter";

export type CatalogFilterStats = {
  apiTotal: number;
  excluded: number;
  validCount: number;
  noImage: number;
  nowPrinting: number;
  noContentId: number;
  noTitle: number;
  other: number;
};

function hasNowPrintingImage(item: DmmItem): boolean {
  const urls = [
    item.imageURL?.large,
    item.imageURL?.list,
    item.imageURL?.small,
  ];
  return urls.some((url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes("now_printing") || lower.includes("nowprinting");
  });
}

function hasNoImageKeyword(item: DmmItem): boolean {
  const urls = [
    item.imageURL?.large,
    item.imageURL?.list,
    item.imageURL?.small,
  ];
  return urls.some((url) => url?.toLowerCase().includes("noimage"));
}

export function analyzeCatalogItems(items: DmmItem[]): CatalogFilterStats {
  const stats: CatalogFilterStats = {
    apiTotal: items.length,
    excluded: 0,
    validCount: 0,
    noImage: 0,
    nowPrinting: 0,
    noContentId: 0,
    noTitle: 0,
    other: 0,
  };

  for (const item of items) {
    if (isValidDmmListItem(item)) {
      stats.validCount += 1;
      continue;
    }

    stats.excluded += 1;

    if (!item.content_id?.trim()) {
      stats.noContentId += 1;
    } else if (!item.title?.trim()) {
      stats.noTitle += 1;
    } else if (hasNowPrintingImage(item)) {
      stats.nowPrinting += 1;
    } else if (!hasValidImage(item) || hasNoImageKeyword(item)) {
      stats.noImage += 1;
    } else {
      stats.other += 1;
    }
  }

  return stats;
}

export function pickValidCatalogItems(
  items: DmmItem[],
  limit: number,
): DmmItem[] {
  const valid: DmmItem[] = [];

  for (const item of items) {
    if (!isValidDmmListItem(item)) continue;
    if (
      !isValidImageUrl(item.imageURL?.large) &&
      !isValidImageUrl(item.imageURL?.list)
    ) {
      continue;
    }
    valid.push(item);
    if (valid.length >= limit) break;
  }

  return valid;
}
