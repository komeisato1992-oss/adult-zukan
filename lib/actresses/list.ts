import "server-only";

import { getDmmItemActressNameList } from "@/lib/dmm/display";
import {
  getCatalogActresses,
  getCatalogItems,
} from "@/lib/dmm/catalog-entities";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getRankedActresses } from "@/lib/dmm/home-sections";
import type { DmmItem } from "@/lib/dmm/types";
import type { ActressListItem } from "@/lib/actresses/sort";

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function buildActressListItems(items: DmmItem[]): ActressListItem[] {
  const actresses = getCatalogActresses(items);
  const popularRanking = getRankedActresses(items, actresses.length);
  const popularOrderMap = new Map(
    popularRanking.map((actress, index) => [actress.name, index]),
  );

  const latestReleaseByActress = new Map<string, number>();
  for (const item of filterDisplayableItems(items)) {
    const timestamp = parseReleaseTimestamp(item);
    for (const name of getDmmItemActressNameList(item)) {
      const current = latestReleaseByActress.get(name) ?? 0;
      if (timestamp > current) {
        latestReleaseByActress.set(name, timestamp);
      }
    }
  }

  return actresses.map((actress) => ({
    name: actress.name,
    slug: actress.slug,
    workCount: actress.workCount,
    imageUrl: actress.imageUrl,
    latestReleaseTimestamp: latestReleaseByActress.get(actress.name) ?? 0,
    popularOrder: popularOrderMap.get(actress.name) ?? Number.MAX_SAFE_INTEGER,
  }));
}

export async function getActressListItems(): Promise<ActressListItem[]> {
  const items = await getCatalogItems();
  return buildActressListItems(items);
}
