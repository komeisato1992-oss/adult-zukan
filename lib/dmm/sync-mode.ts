/**
 * アダルト FANZA 同期モード（文字列直書き禁止）。
 */

export const ADULT_SYNC_MODE_LIGHT = "light" as const;
export const ADULT_SYNC_MODE_FULL = "full" as const;

export type AdultSyncMode =
  | typeof ADULT_SYNC_MODE_LIGHT
  | typeof ADULT_SYNC_MODE_FULL;

/** 軽量同期で更新してよいフィールド */
export const ADULT_SYNC_LIGHT_FIELDS = [
  "prices",
  "salePrice",
  "regularPrice",
  "discountRate",
  "saleStatus",
  "saleEndAt",
  "campaign",
  "review",
  "sourcePopularityRank",
] as const;

export type AdultSyncLightField = (typeof ADULT_SYNC_LIGHT_FIELDS)[number];

export function isAdultSyncMode(value: unknown): value is AdultSyncMode {
  return value === ADULT_SYNC_MODE_LIGHT || value === ADULT_SYNC_MODE_FULL;
}

export function isAdultLightSyncEnabled(): boolean {
  return process.env.ADULT_LIGHT_SYNC_ENABLED === "true";
}

export function isAdultFullSyncEnabled(): boolean {
  return process.env.ADULT_FULL_SYNC_ENABLED === "true";
}

export function getAdultLightSyncBatchSize(): number {
  const n = Number(process.env.ADULT_LIGHT_SYNC_BATCH_SIZE ?? 500);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return Math.min(500, Math.floor(n));
}

export function getAdultFullSyncBatchSize(): number {
  const n = Number(process.env.ADULT_FULL_SYNC_BATCH_SIZE ?? 100);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100, Math.floor(n));
}

export function getAdultSyncBatchSizeForMode(mode: AdultSyncMode): number {
  return mode === ADULT_SYNC_MODE_LIGHT
    ? getAdultLightSyncBatchSize()
    : getAdultFullSyncBatchSize();
}
