import "server-only";

import { getRelatedWorksFromCatalog } from "@/lib/catalog";
import type { DmmItem } from "@/lib/dmm/types";

export async function getDmmRelatedWorks(
  item: DmmItem,
): Promise<DmmItem[]> {
  return getRelatedWorksFromCatalog(item);
}
