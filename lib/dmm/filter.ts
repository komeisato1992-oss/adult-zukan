import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage, getValidImageUrl } from "@/lib/works";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";

const IMAGE_EXTENSIONS = /\.(jpe?g|webp)(\?|$)/i;

function isVrItem(item: DmmItem): boolean {
  if (item.content_id?.toLowerCase().startsWith("vr")) return true;
  if (item.title.includes("【VR】") || item.title.includes("[VR]")) return true;

  const genres = item.iteminfo?.genre ?? [];
  return genres.some((genre) => /VR/i.test(genre.name));
}

/** 一覧・静的生成用：有効なDMM作品か判定 */
export function isValidDmmListItem(item: DmmItem): boolean {
  if (!item.content_id?.trim()) return false;
  if (!item.title?.trim()) return false;
  if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
  if (isVrItem(item)) return false;

  if (!hasValidImage(item)) return false;
  if (!getDmmFanzaUrl(item)) return false;

  const image = getValidImageUrl(item, ["large", "list"]);
  if (!image) return false;

  return IMAGE_EXTENSIONS.test(image);
}

export function filterValidListItems(items: DmmItem[]): DmmItem[] {
  return items.filter(isValidDmmListItem);
}

/** @deprecated filterValidListItems を使用 */
export function hasValidJacketImage(item: DmmItem): boolean {
  return isValidDmmListItem(item);
}

export function filterValidJacketItems(items: DmmItem[]): DmmItem[] {
  return filterValidListItems(items);
}
