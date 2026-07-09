import type { DmmItem } from "@/lib/dmm/types";
import {
  getDmmItemActressNameList,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { normalizeSearchText } from "@/lib/search/normalize-text";

export type SearchIndexFieldKey =
  | "title"
  | "actress"
  | "maker"
  | "label"
  | "series"
  | "genre"
  | "contentId"
  | "productId";

export type SearchIndexFields = Record<SearchIndexFieldKey, string>;

function normalizeField(value: string): string {
  const normalized = normalizeSearchText(value);
  return normalized || "";
}

/** 作品ごとの正規化済み検索フィールド */
export function buildSearchIndexFields(item: DmmItem): SearchIndexFields {
  const genres = (item.iteminfo?.genre ?? [])
    .map((genre) => genre.name)
    .filter(Boolean)
    .join(" ");

  return {
    title: normalizeField(item.title ?? ""),
    actress: normalizeField(getDmmItemActressNameList(item).join(" ")),
    maker: normalizeField(getDmmItemMakerName(item) ?? ""),
    label: normalizeField(getDmmItemLabelName(item) ?? ""),
    series: normalizeField(getDmmItemSeriesName(item) ?? ""),
    genre: normalizeField(genres),
    contentId: normalizeField(item.content_id ?? ""),
    productId: normalizeField(item.product_id ?? ""),
  };
}

/** インデックス照合用の正規化フィールド配列（空は除外） */
export function buildSearchFieldValues(item: DmmItem): string[] {
  const fields = buildSearchIndexFields(item);
  return Object.values(fields).filter(Boolean);
}

/** @deprecated buildSearchFieldValues / buildSearchIndexFields を使用 */
export function buildSearchText(item: DmmItem): string {
  return buildSearchFieldValues(item).join("");
}
