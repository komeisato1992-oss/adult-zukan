import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { filterValidJacketItems } from "@/lib/dmm/filter";
import { getDmmItemMakerName } from "@/lib/dmm/display";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

const RELATED_LIMIT = 8;

export async function getDmmRelatedWorks(
  item: DmmItem,
): Promise<DmmItem[]> {
  if (!isDmmConfigured()) {
    return [];
  }

  const actresses = item.actress ?? item.iteminfo?.actress ?? [];
  const actressName = actresses[0]?.name;
  const makerName = getDmmItemMakerName(item);
  const keyword = actressName ?? makerName;

  if (!keyword) {
    return [];
  }

  try {
    const data = await fetchDmmItemList({
      keyword,
      hits: RELATED_LIMIT + 5,
      sort: "date",
      revalidate: DMM_WORKS_REVALIDATE,
    });

    return filterItemsWithValidImage(
      filterValidJacketItems(data.result.items),
    )
      .filter((related) => related.content_id !== item.content_id)
      .slice(0, RELATED_LIMIT);
  } catch {
    return [];
  }
}
