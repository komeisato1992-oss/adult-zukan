import type { DmmItem } from "@/lib/dmm/types";

const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|$)/i;

const INVALID_IMAGE_KEYWORDS = [
  "now_printing",
  "nowprinting",
  "noimage",
] as const;

const MONO_PLACEHOLDER_PATTERN = /(^|[/_.-])mono([/_.-]|\.|$)/i;

export function isValidImageUrl(url?: string | null): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  if (INVALID_IMAGE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }

  if (MONO_PLACEHOLDER_PATTERN.test(trimmed)) {
    return false;
  }

  return IMAGE_EXTENSIONS.test(trimmed);
}

export function hasValidImage(item: DmmItem): boolean {
  if (!item.imageURL) return false;

  return [item.imageURL.large, item.imageURL.list, item.imageURL.small].some(
    isValidImageUrl,
  );
}

export function getValidImageUrl(
  item: DmmItem,
  order: Array<"large" | "list" | "small"> = ["large", "list", "small"],
): string | undefined {
  if (!item.imageURL) return undefined;

  for (const key of order) {
    const url = item.imageURL[key];
    if (isValidImageUrl(url)) {
      return url!.trim();
    }
  }

  return undefined;
}

export function filterItemsWithValidImage<T extends DmmItem>(items: T[]): T[] {
  return items.filter(hasValidImage);
}
