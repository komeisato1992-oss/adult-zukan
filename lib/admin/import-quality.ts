import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import { storedCandidateToDmmItem } from "@/lib/admin/import-candidate-mapper";
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

export type ImportQualityFilterKey =
  | "hasImage"
  | "hasActress"
  | "hasPrice"
  | "hasDescription"
  | "hasSampleImages"
  | "isSoloWork"
  | "isOnSale";

export type ImportSeoFilterKey =
  | "seoRankingOnly"
  | "seoNewReleaseOnly"
  | "seoPopularActressOnly"
  | "seoPopularMakerOnly"
  | "seoPopularSeriesOnly";

export type ImportFilterKey = ImportQualityFilterKey | ImportSeoFilterKey;

export type ImportQualityFlags = Record<ImportQualityFilterKey, boolean>;

export const IMPORT_QUALITY_FILTER_LABELS: Record<ImportQualityFilterKey, string> = {
  hasImage: "画像あり",
  hasActress: "女優あり",
  hasPrice: "価格あり",
  hasDescription: "説明文あり",
  hasSampleImages: "サンプル画像あり",
  isSoloWork: "単体作品",
  isOnSale: "セール中",
};

export const IMPORT_SEO_FILTER_LABELS: Record<ImportSeoFilterKey, string> = {
  seoRankingOnly: "ランキング作品のみ",
  seoNewReleaseOnly: "新作のみ",
  seoPopularActressOnly: "人気女優のみ",
  seoPopularMakerOnly: "人気メーカーのみ",
  seoPopularSeriesOnly: "人気シリーズのみ",
};

export const IMPORT_FILTER_LABELS: Record<ImportFilterKey, string> = {
  ...IMPORT_QUALITY_FILTER_LABELS,
  ...IMPORT_SEO_FILTER_LABELS,
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

const SEO_FILTER_KEYS = new Set<ImportFilterKey>([
  "seoRankingOnly",
  "seoNewReleaseOnly",
  "seoPopularActressOnly",
  "seoPopularMakerOnly",
  "seoPopularSeriesOnly",
]);

function isSeoFilterKey(key: ImportFilterKey): key is ImportSeoFilterKey {
  return SEO_FILTER_KEYS.has(key);
}

export function matchesImportListItemFilter(
  candidate: {
    item: DmmItem;
    seoFlags?: StoredImportCandidate["seoFlags"];
  },
  key: ImportFilterKey,
): boolean {
  if (isSeoFilterKey(key)) {
    const seoFlags = candidate.seoFlags;
    if (!seoFlags) return false;

    switch (key) {
      case "seoRankingOnly":
        return seoFlags.isRankingListed;
      case "seoNewReleaseOnly":
        return seoFlags.isNewRelease;
      case "seoPopularActressOnly":
        return seoFlags.hasPopularActress;
      case "seoPopularMakerOnly":
        return seoFlags.hasPopularMaker;
      case "seoPopularSeriesOnly":
        return seoFlags.hasPopularSeries;
      default:
        return false;
    }
  }

  return getImportQualityFlags(candidate.item)[key];
}

export function matchesImportFilters(
  item: DmmItem,
  activeFilters: Set<ImportFilterKey>,
): boolean {
  if (activeFilters.size === 0) return true;

  const flags = getImportQualityFlags(item);
  return [...activeFilters]
    .filter((key) => !isSeoFilterKey(key))
    .every((key) => flags[key as ImportQualityFilterKey]);
}

export function matchesImportRecordFilters(
  record: StoredImportCandidate,
  activeFilters: Set<ImportFilterKey>,
): boolean {
  if (activeFilters.size === 0) return true;

  const item = storedCandidateToDmmItem(record);
  if (!matchesImportFilters(item, activeFilters)) {
    return false;
  }

  const seoFlags = record.seoFlags;
  if (!seoFlags) {
    return [...activeFilters].every((key) => !isSeoFilterKey(key));
  }

  for (const key of activeFilters) {
    if (!isSeoFilterKey(key)) continue;

    switch (key) {
      case "seoRankingOnly":
        if (!seoFlags.isRankingListed) return false;
        break;
      case "seoNewReleaseOnly":
        if (!seoFlags.isNewRelease) return false;
        break;
      case "seoPopularActressOnly":
        if (!seoFlags.hasPopularActress) return false;
        break;
      case "seoPopularMakerOnly":
        if (!seoFlags.hasPopularMaker) return false;
        break;
      case "seoPopularSeriesOnly":
        if (!seoFlags.hasPopularSeries) return false;
        break;
    }
  }

  return true;
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
