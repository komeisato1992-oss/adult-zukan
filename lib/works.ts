import type { DmmItem } from "@/lib/dmm/types";
import {
  hasValidPackageImage,
  resolvePackageImageUrl,
} from "@/lib/works/package-image";

export {
  hasValidPackageImage,
  isValidImageUrl,
  resolvePackageImageUrl,
} from "@/lib/works/package-image";

export function hasValidImage(item: DmmItem): boolean {
  return hasValidPackageImage(item);
}

export function getValidImageUrl(
  item: DmmItem,
  order: Array<"large" | "list" | "small"> = ["large", "list", "small"],
): string | undefined {
  return resolvePackageImageUrl(item, order) ?? undefined;
}

export function filterItemsWithValidImage<T extends DmmItem>(items: T[]): T[] {
  return items.filter(hasValidImage);
}
