import "server-only";

import { unstable_cache } from "next/cache";
import { readCatalogSnapshot, writeCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { getDmmListItems } from "@/lib/dmm/list-items";
import type { DmmItem } from "@/lib/dmm/types";

/** DMM作品ページのISR再検証間隔（24時間） */
export const DMM_WORKS_REVALIDATE = 86400;

export const DMM_STATIC_WORKS_COUNT = 1000;

/** FANZAランキング順（DMM API sort=rank） */
export const DMM_CATALOG_SORT = "rank" as const;

async function fetchDmmStaticWorksUncached(): Promise<DmmItem[]> {
  const items = await getDmmListItems({
    limit: DMM_STATIC_WORKS_COUNT,
    sort: DMM_CATALOG_SORT,
  });

  if (items.length > 0) {
    writeCatalogSnapshot(items);
    return items;
  }

  return readCatalogSnapshot().slice(0, DMM_STATIC_WORKS_COUNT);
}

export const getDmmStaticWorks = unstable_cache(
  fetchDmmStaticWorksUncached,
  ["dmm-static-works-v4", "1000", "rank"],
  { revalidate: DMM_WORKS_REVALIDATE },
);

export async function getDmmStaticWorkContentIds(): Promise<string[]> {
  const items = await getDmmStaticWorks();
  return items.map((item) => item.content_id);
}
