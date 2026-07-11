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
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";

export function dmmItemToStoredCandidate(
  item: DmmItem,
  source: string,
  options?: {
    collectionMode?: ImportCollectionMode;
    rankPosition?: number | null;
    seoScore?: number;
    seoReasons?: string[];
    seoFlags?: StoredImportCandidate["seoFlags"];
  },
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
    collectionMode: options?.collectionMode,
    rankPosition: options?.rankPosition ?? null,
    seoScore: options?.seoScore,
    seoReasons: options?.seoReasons,
    seoFlags: options?.seoFlags,
    item,
  };
}

function flatFieldsToDmmItem(record: StoredImportCandidate): DmmItem {
  const actresses = record.actresses ?? [];
  const genres = record.genres ?? [];
  const imageURL = record.imageURL?.trim();

  return {
    content_id: record.content_id,
    title: record.title || record.content_id,
    imageURL: imageURL
      ? { large: imageURL, list: imageURL, small: imageURL }
      : undefined,
    iteminfo: {
      actress: actresses.map((name) => ({ name })),
      genre: genres.map((name) => ({ name })),
      maker: record.maker ? [{ name: record.maker }] : undefined,
      label: record.label ? [{ name: record.label }] : undefined,
      series: record.series ? [{ name: record.series }] : undefined,
    },
    prices: record.price ? { price: record.price } : undefined,
    date: record.releaseDate || undefined,
    volume: record.duration != null ? String(record.duration) : undefined,
    affiliateURL: record.affiliateURL || undefined,
    URL: record.affiliateURL || undefined,
    sampleImageURL: record.sampleImages?.length
      ? { sample_s: { image: record.sampleImages } }
      : undefined,
  } as DmmItem;
}

export function storedCandidateToDmmItem(record: StoredImportCandidate): DmmItem {
  if (record.item && typeof record.item === "object") {
    const item = record.item;
    if (item.content_id?.trim() && item.title?.trim()) {
      return item;
    }
    if (item.content_id?.trim()) {
      return {
        ...item,
        title: item.title?.trim() || record.title || record.content_id,
      };
    }
  }

  return flatFieldsToDmmItem(record);
}

export function normalizeImportContentId(value: string): string {
  return value.trim().toLowerCase();
}
