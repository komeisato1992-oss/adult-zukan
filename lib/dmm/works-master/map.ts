import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
  getDmmSampleImages,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import type {
  WorkMasterNamedEntity,
  WorkMasterRow,
  WorkMasterUpsertInput,
} from "@/lib/dmm/works-master/types";

function namedList(
  items: Array<{ id?: number; name?: string; ruby?: string }> | undefined,
  fallbackNames: string[],
): WorkMasterNamedEntity[] {
  if (items?.length) {
    return items
      .filter((entry) => entry.name?.trim())
      .map((entry) => ({
        id: typeof entry.id === "number" ? entry.id : undefined,
        name: String(entry.name).trim(),
        ruby: entry.ruby?.trim() || undefined,
      }));
  }
  return fallbackNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

/** DmmItem → works 行 */
export function dmmItemToWorkMasterRow(
  item: DmmItem,
  options?: { published?: boolean; now?: string },
): WorkMasterUpsertInput | null {
  const cid = normalizeCatalogContentId(item.content_id);
  if (!cid) return null;
  const now = options?.now ?? new Date().toISOString();
  const actresses = namedList(
    item.actress ?? item.iteminfo?.actress,
    getDmmItemActressNameList(item),
  );
  const genres = namedList(
    item.iteminfo?.genre,
    getDmmItemGenreNameList(item),
  );

  return {
    cid,
    slug: cid,
    title: item.title?.trim() || cid,
    description:
      item.description?.trim() ||
      item.comment?.trim() ||
      null,
    package_image: getDmmItemImageUrl(item) ?? item.imageURL?.large ?? item.imageURL?.list ?? null,
    sample_images: getDmmSampleImages(item),
    actresses,
    maker: getDmmItemMakerName(item) ?? null,
    label: getDmmItemLabelName(item) ?? null,
    series: getDmmItemSeriesName(item) ?? null,
    genres,
    release_date: item.date?.trim() || null,
    duration: item.volume?.trim() || null,
    product_code: item.product_id?.trim() || cid,
    affiliate_url: item.affiliateURL?.trim() || item.URL?.trim() || null,
    published: options?.published ?? true,
    manual_hidden: false,
    manual_hidden_reason: null,
    deleted_at: null,
    created_at: item.addedAt ?? item.importedAt ?? now,
    updated_at: now,
  };
}

/** works 行 → DmmItem（公開表示用） */
export function workMasterRowToDmmItem(row: WorkMasterRow): DmmItem {
  const actresses = (row.actresses ?? []).map((entry, index) => ({
    id: entry.id ?? index + 1,
    name: entry.name,
    ruby: entry.ruby,
  }));
  const genres = (row.genres ?? []).map((entry, index) => ({
    id: entry.id ?? index + 1,
    name: entry.name,
  }));
  const maker = row.maker
    ? [{ id: 1, name: row.maker }]
    : undefined;
  const label = row.label
    ? [{ id: 1, name: row.label }]
    : undefined;
  const series = row.series
    ? [{ id: 1, name: row.series }]
    : undefined;

  const sampleImages = Array.isArray(row.sample_images)
    ? row.sample_images.filter(Boolean)
    : [];

  return {
    content_id: row.cid,
    product_id: row.product_code ?? row.cid,
    title: row.title,
    description: row.description ?? undefined,
    URL: row.affiliate_url || "",
    affiliateURL: row.affiliate_url || "",
    imageURL: row.package_image
      ? {
          list: row.package_image,
          small: row.package_image,
          large: row.package_image,
        }
      : undefined,
    sampleImageURL:
      sampleImages.length > 0
        ? {
            sample_l: { image: sampleImages },
            sample: { image: sampleImages },
          }
        : undefined,
    date: row.release_date ?? undefined,
    volume: row.duration ?? undefined,
    actress: actresses,
    maker,
    label,
    series,
    iteminfo: {
      actress: actresses,
      maker,
      label,
      series,
      genre: genres,
    },
    isActive: row.published && !row.manual_hidden && !row.deleted_at,
    availabilityStatus:
      row.published && !row.manual_hidden && !row.deleted_at
        ? "available"
        : "unavailable",
    hiddenReason: row.manual_hidden ? "manual" : undefined,
    addedAt: row.created_at,
    importedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
