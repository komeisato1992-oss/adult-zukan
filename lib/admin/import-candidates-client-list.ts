import type {
  ImportCandidateListItem,
  ImportCandidateSortKey,
} from "@/lib/admin/import-candidate-types";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { getImportQualityFlags } from "@/lib/admin/import-quality";

function getTime(value?: string): number {
  if (!value?.trim()) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getPrice(value?: number | string | null): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isNaN(value) ? 0 : value;
  }
  const price = parseDmmPrice(value);
  return Number.isNaN(price) ? 0 : price;
}

function getReleaseTime(item: DmmItem): number {
  return getTime(item.date?.split(" ")[0]);
}

function compareCollectedAtDesc(
  a: ImportCandidateListItem,
  b: ImportCandidateListItem,
): number {
  return getTime(b.collectedAt) - getTime(a.collectedAt);
}

function compareReleaseDateDesc(a: DmmItem, b: DmmItem): number {
  return getReleaseTime(b) - getReleaseTime(a);
}

function comparePriceDesc(a: DmmItem, b: DmmItem): number {
  const priceA = getPrice(a.prices?.price ?? a.prices?.list_price);
  const priceB = getPrice(b.prices?.price ?? b.prices?.list_price);
  return priceB - priceA;
}

/** 元配列は変更せず、並び替え済みコピーを返す */
export function sortImportCandidateListItems(
  items: ImportCandidateListItem[],
  sort: ImportCandidateSortKey,
): ImportCandidateListItem[] {
  const sorted = [...items];

  switch (sort) {
    case "collectedAt-desc":
      sorted.sort(compareCollectedAtDesc);
      return sorted;
    case "releaseDate-desc":
      sorted.sort((a, b) => compareReleaseDateDesc(a.item, b.item));
      return sorted;
    case "price-desc":
      sorted.sort((a, b) => comparePriceDesc(a.item, b.item));
      return sorted;
    case "actress-first":
      sorted.sort((a, b) => {
        const actressA = getImportQualityFlags(a.item).hasActress ? 1 : 0;
        const actressB = getImportQualityFlags(b.item).hasActress ? 1 : 0;
        if (actressA !== actressB) return actressB - actressA;
        return compareCollectedAtDesc(a, b);
      });
      return sorted;
    case "image-first":
      sorted.sort((a, b) => {
        const imageA = getImportQualityFlags(a.item).hasImage ? 1 : 0;
        const imageB = getImportQualityFlags(b.item).hasImage ? 1 : 0;
        if (imageA !== imageB) return imageB - imageA;
        return compareCollectedAtDesc(a, b);
      });
      return sorted;
    case "random": {
      const shuffled = [...sorted];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      return shuffled;
    }
    default:
      return sorted;
  }
}
