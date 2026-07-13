import "server-only";

import {
  DOUJIN_ITEMLIST_MAX_HITS,
  DOUJIN_ITEMLIST_MAX_OFFSET,
  DOUJIN_RECOMMENDED_FLOOR,
} from "@/lib/doujin/floor-config";

function readPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function getDoujinImportBatchSize(): number {
  // DOUJIN_ADMIN_BATCH_SIZE を優先（管理APIの短いバッチ方針）
  const admin = Number(process.env.DOUJIN_ADMIN_BATCH_SIZE);
  if (Number.isFinite(admin) && admin > 0) {
    return Math.min(DOUJIN_ITEMLIST_MAX_HITS, Math.floor(admin));
  }
  return Math.min(
    DOUJIN_ITEMLIST_MAX_HITS,
    readPositiveInt(process.env.DOUJIN_IMPORT_BATCH_SIZE, 100),
  );
}

export function getDoujinImportRequestDelayMs(): number {
  return readPositiveInt(process.env.DOUJIN_IMPORT_REQUEST_DELAY_MS, 1000);
}

export function getDoujinImportMaxRetries(): number {
  return readPositiveInt(process.env.DOUJIN_IMPORT_MAX_RETRIES, 5);
}

export function getDoujinImportMaxEmptyNewBatches(): number {
  return readPositiveInt(process.env.DOUJIN_IMPORT_MAX_EMPTY_NEW_BATCHES, 30);
}

export function getDoujinImportMaxBatches(): number {
  return readPositiveInt(process.env.DOUJIN_IMPORT_MAX_BATCHES, 2000);
}

export const DOUJIN_IMPORT_POPULAR_SORT = "rank" as const;
export const DOUJIN_IMPORT_NEW_SORT = "date" as const;
export const DOUJIN_IMPORT_OFFSET_START = 1;
export const DOUJIN_IMPORT_OFFSET_MAX = DOUJIN_ITEMLIST_MAX_OFFSET;

export const DOUJIN_IMPORT_DEFAULT_FLOOR = DOUJIN_RECOMMENDED_FLOOR;

export const DOUJIN_IMPORT_POPULAR_TARGET = 4000;
export const DOUJIN_IMPORT_NEW_TARGET = 1000;
