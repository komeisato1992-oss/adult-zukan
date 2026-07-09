import "server-only";

import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";

export function getCatalogSnapshotFingerprint(
  snapshot: DmmItem[] = readCatalogSnapshot(),
): string {
  const first = snapshot[0]?.content_id ?? "";
  const last = snapshot[snapshot.length - 1]?.content_id ?? "";
  return `${snapshot.length}:${first}:${last}`;
}
