import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  buildCatalogOutput,
  CATALOG_SNAPSHOT_RELATIVE_PATH,
  parseCatalogSnapshot,
  parseJsonMaybe,
  serializeCatalogSnapshot,
} from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "dmm");
const SNAPSHOT_FILE = path.join(process.cwd(), CATALOG_SNAPSHOT_RELATIVE_PATH);

let cachedSnapshotItems: DmmItem[] | null = null;

export function clearCatalogSnapshotCache(): void {
  cachedSnapshotItems = null;
}

function readCatalogSnapshotRaw(): unknown {
  if (!existsSync(SNAPSHOT_FILE)) {
    return [];
  }

  try {
    return parseJsonMaybe(readFileSync(SNAPSHOT_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function readCatalogSnapshot(): DmmItem[] {
  if (cachedSnapshotItems) {
    return cachedSnapshotItems;
  }

  cachedSnapshotItems = parseCatalogSnapshot(readCatalogSnapshotRaw()).items;
  return cachedSnapshotItems;
}

export function writeCatalogSnapshot(items: DmmItem[]): void {
  const raw = readCatalogSnapshotRaw();
  const saveData = buildCatalogOutput(raw, items);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_FILE, serializeCatalogSnapshot(saveData), "utf-8");
  clearCatalogSnapshotCache();
}

export function normalizeCatalogContentId(value: string): string {
  return value.trim().toLowerCase();
}

export function catalogHasContentId(
  items: DmmItem[],
  contentId: string,
): boolean {
  const normalizedId = normalizeCatalogContentId(contentId);
  return items.some(
    (entry) => normalizeCatalogContentId(entry.content_id) === normalizedId,
  );
}

export { CATALOG_SNAPSHOT_RELATIVE_PATH };
