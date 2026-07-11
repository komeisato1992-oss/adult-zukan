import "server-only";

import { getCatalogFingerprint } from "@/lib/dmm/catalog-shards";
import type { DmmItem } from "@/lib/dmm/types";

export function getCatalogSnapshotFingerprint(
  _snapshot?: DmmItem[],
): string {
  return getCatalogFingerprint();
}
