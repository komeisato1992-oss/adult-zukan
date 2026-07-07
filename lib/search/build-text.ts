import type { DmmItem } from "@/lib/dmm/types";
import {
  getDmmItemActressNameList,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { normalizeSearchQuery } from "@/lib/search/normalize-query";

export function buildSearchText(item: DmmItem): string {
  const genres = (item.iteminfo?.genre ?? [])
    .map((genre) => genre.name)
    .filter(Boolean)
    .join(" ");
  const actresses = getDmmItemActressNameList(item).join(" ");
  const maker = getDmmItemMakerName(item) ?? "";
  const label = getDmmItemLabelName(item) ?? "";
  const series = getDmmItemSeriesName(item) ?? "";

  const text = [
    item.title,
    item.content_id,
    item.product_id,
    actresses,
    maker,
    label,
    series,
    genres,
  ].join(" ");

  return normalizeSearchQuery(text);
}
