import { getDmmItemDescription } from "@/lib/dmm/description";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmItemSeriesName,
  getDmmSampleImages,
} from "@/lib/dmm/display";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { DmmItem } from "@/lib/dmm/types";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";

export function dmmItemToStoredCandidate(
  item: DmmItem,
  source: string,
): StoredImportCandidate {
  const duration = item.volume?.trim() ? Number.parseInt(item.volume, 10) : null;

  return {
    content_id: item.content_id,
    title: item.title,
    imageURL: getDmmItemImageUrl(item) ?? "",
    actresses: getDmmItemActressNameList(item),
    maker: getDmmItemMakerName(item) ?? "",
    label: getDmmItemLabelName(item) ?? "",
    series: getDmmItemSeriesName(item) ?? "",
    genres: getDmmItemGenreNameList(item),
    price: getDmmItemPrice(item) ?? "",
    releaseDate: getDmmReleaseDateInfo(item)?.value ?? "",
    duration: Number.isFinite(duration) ? duration : null,
    affiliateURL: item.affiliateURL ?? item.URL ?? "",
    description: getDmmItemDescription(item) ?? "",
    sampleImages: getDmmSampleImages(item),
    source,
    collectedAt: new Date().toISOString(),
    status: "candidate",
    item,
  };
}

export function storedCandidateToDmmItem(record: StoredImportCandidate): DmmItem {
  return record.item;
}

export function normalizeImportContentId(value: string): string {
  return value.trim().toLowerCase();
}
