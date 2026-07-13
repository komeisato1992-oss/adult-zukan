/**
 * 同人 FANZA 同期モード（文字列直書き禁止）。
 */

export const DOUJIN_SYNC_MODE_LIGHT = "light" as const;
export const DOUJIN_SYNC_MODE_FULL = "full" as const;

export type DoujinSyncMode =
  | typeof DOUJIN_SYNC_MODE_LIGHT
  | typeof DOUJIN_SYNC_MODE_FULL;

export const DOUJIN_SYNC_LIGHT_FIELDS = [
  "price",
  "originalPrice",
  "discountRate",
  "isSale",
  "saleEndAt",
  "rating",
  "reviewCount",
  "currentPopularRank",
] as const;

export type DoujinSyncLightField = (typeof DOUJIN_SYNC_LIGHT_FIELDS)[number];

export function isDoujinSyncMode(value: unknown): value is DoujinSyncMode {
  return value === DOUJIN_SYNC_MODE_LIGHT || value === DOUJIN_SYNC_MODE_FULL;
}

export function isDoujinLightSyncEnabled(): boolean {
  return process.env.DOUJIN_LIGHT_SYNC_ENABLED === "true";
}

/** 未設定時は必ず無効 */
export function isDoujinFullSyncEnabled(): boolean {
  return process.env.DOUJIN_FULL_SYNC_ENABLED === "true";
}

export function getDoujinLightSyncBatchSize(): number {
  const n = Number(process.env.DOUJIN_LIGHT_SYNC_BATCH_SIZE ?? 500);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return Math.min(500, Math.floor(n));
}

export function getDoujinFullSyncBatchSize(): number {
  const n = Number(process.env.DOUJIN_FULL_SYNC_BATCH_SIZE ?? 100);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100, Math.floor(n));
}

export function getSyncBatchSizeForMode(mode: DoujinSyncMode): number {
  return mode === DOUJIN_SYNC_MODE_LIGHT
    ? getDoujinLightSyncBatchSize()
    : getDoujinFullSyncBatchSize();
}
