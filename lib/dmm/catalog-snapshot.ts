import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { DmmItem } from "@/lib/dmm/types";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "dmm");
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "catalog-snapshot.json");

export function readCatalogSnapshot(): DmmItem[] {
  if (!existsSync(SNAPSHOT_FILE)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8")) as unknown;
    return Array.isArray(parsed) ? (parsed as DmmItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCatalogSnapshot(items: DmmItem[]): void {
  if (items.length === 0) {
    return;
  }

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(items, null, 2), "utf-8");
}
