import { getDmmItemDescription } from "@/lib/dmm/description";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
  getDmmSampleImages,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";

export type ImportFilterKey =
  | "hasImage"
  | "hasActress"
  | "hasPrice"
  | "hasDescription"
  | "hasSampleImages"
  | "isSoloWork"
  | "isOnSale";

export type ImportQualityFlags = Record<ImportFilterKey, boolean>;

export const IMPORT_FILTER_LABELS: Record<ImportFilterKey, string> = {
  hasImage: "画像あり",
  hasActress: "女優あり",
  hasPrice: "価格あり",
  hasDescription: "説明文あり",
  hasSampleImages: "サンプル画像あり",
  isSoloWork: "単体作品",
  isOnSale: "セール作品",
};

function isDmmItemOnSale(item: DmmItem): boolean {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
}

export function getImportQualityFlags(item: DmmItem): ImportQualityFlags {
  const actresses = getDmmItemActressNameList(item);

  return {
    hasImage: Boolean(getDmmItemImageUrl(item)),
    hasActress: actresses.length > 0,
    hasPrice: Boolean(getDmmItemPrice(item)),
    hasDescription: Boolean(getDmmItemDescription(item)),
    hasSampleImages: getDmmSampleImages(item).length > 0,
    isSoloWork: actresses.length === 1,
    isOnSale: isDmmItemOnSale(item),
  };
}

export function matchesImportFilters(
  item: DmmItem,
  activeFilters: Set<ImportFilterKey>,
): boolean {
  if (activeFilters.size === 0) return true;

  const flags = getImportQualityFlags(item);
  return [...activeFilters].every((key) => flags[key]);
}

export type ImportSelectionSummary = {
  total: number;
  noImage: number;
  noActress: number;
  noPrice: number;
  noDescription: number;
  noSampleImages: number;
};

export type ImportBulkConfirmSummary = ImportSelectionSummary & {
  selectedCount: number;
  toAddCount: number;
  duplicateCount: number;
};

export function summarizeImportSelection(items: DmmItem[]): ImportSelectionSummary {
  const summary: ImportSelectionSummary = {
    total: items.length,
    noImage: 0,
    noActress: 0,
    noPrice: 0,
    noDescription: 0,
    noSampleImages: 0,
  };

  for (const item of items) {
    const flags = getImportQualityFlags(item);
    if (!flags.hasImage) summary.noImage += 1;
    if (!flags.hasActress) summary.noActress += 1;
    if (!flags.hasPrice) summary.noPrice += 1;
    if (!flags.hasDescription) summary.noDescription += 1;
    if (!flags.hasSampleImages) summary.noSampleImages += 1;
  }

  return summary;
}

export function isImportCandidateEligible(item: DmmItem): boolean {
  const flags = getImportQualityFlags(item);
  return flags.hasImage && flags.hasPrice && Boolean(getDmmFanzaUrl(item));
}
