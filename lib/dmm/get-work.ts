import "server-only";

import { getCatalogWorkByContentId } from "@/lib/catalog";
import type { DmmItem } from "@/lib/dmm/types";

export async function getDmmWorkByContentId(
  contentId: string,
): Promise<DmmItem | null> {
  return getCatalogWorkByContentId(contentId);
}
