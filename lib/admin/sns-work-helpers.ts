import { getDmmItemActressNameList } from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function findRepresentativeWorkForActress(
  items: DmmItem[],
  actressName: string,
): DmmItem | null {
  const matching = filterDisplayableItems(items).filter((item) =>
    getDmmItemActressNameList(item).includes(actressName),
  );

  if (matching.length === 0) return null;

  return [...matching].sort(
    (a, b) => parseReleaseTimestamp(b) - parseReleaseTimestamp(a),
  )[0];
}
