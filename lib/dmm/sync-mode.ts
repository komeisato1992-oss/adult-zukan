/**
 * アダルト FANZA 同期モード（文字列直書き禁止）。
 */

export const ADULT_SYNC_MODE_LIGHT = "light" as const;
export const ADULT_SYNC_MODE_PRICE = "price" as const;
export const ADULT_SYNC_MODE_RANK = "rank" as const;
export const ADULT_SYNC_MODE_DATE = "date" as const;
export const ADULT_SYNC_MODE_FULL = "full" as const;

export type AdultSyncMode =
  | typeof ADULT_SYNC_MODE_LIGHT
  | typeof ADULT_SYNC_MODE_PRICE
  | typeof ADULT_SYNC_MODE_RANK
  | typeof ADULT_SYNC_MODE_DATE
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

export const ADULT_SYNC_PRICE_FIELDS = [
  "prices",
  "salePrice",
  "regularPrice",
  "discountRate",
  "saleStatus",
  "saleEndAt",
  "campaign",
] as const;

export const ADULT_SYNC_RANK_FIELDS = ["sourcePopularityRank"] as const;

export const ADULT_SYNC_DATE_FIELDS = ["date"] as const;

export type AdultSyncLightField = (typeof ADULT_SYNC_LIGHT_FIELDS)[number];

export function isAdultSyncMode(value: unknown): value is AdultSyncMode {
  return (
    value === ADULT_SYNC_MODE_LIGHT ||
    value === ADULT_SYNC_MODE_PRICE ||
    value === ADULT_SYNC_MODE_RANK ||
    value === ADULT_SYNC_MODE_DATE ||
    value === ADULT_SYNC_MODE_FULL
  );
}

/** 部分同期（フル以外）かどうか */
export function isAdultPartialSyncMode(mode: AdultSyncMode): boolean {
  return mode !== ADULT_SYNC_MODE_FULL;
}

export function getAdultSyncModeLabel(mode: AdultSyncMode): string {
  switch (mode) {
    case ADULT_SYNC_MODE_LIGHT:
      return "軽量同期（価格・セール・評価・順位）";
    case ADULT_SYNC_MODE_PRICE:
      return "価格だけ更新";
    case ADULT_SYNC_MODE_RANK:
      return "人気順位だけ更新";
    case ADULT_SYNC_MODE_DATE:
      return "新着（発売日）だけ更新";
    case ADULT_SYNC_MODE_FULL:
      return "完全同期（全データ）";
    default:
      return mode;
  }
}

export function isAdultLightSyncEnabled(): boolean {
  // 動的設定は admin-ops-settings 経由（循環 import 回避のため遅延 require しない）
  // 呼び出し側では resolveLightSyncEnabled を優先
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
  return mode === ADULT_SYNC_MODE_FULL
    ? getAdultFullSyncBatchSize()
    : getAdultLightSyncBatchSize();
}

export function getAdultSyncFieldsForMode(
  mode: AdultSyncMode,
): readonly string[] {
  switch (mode) {
    case ADULT_SYNC_MODE_PRICE:
      return ADULT_SYNC_PRICE_FIELDS;
    case ADULT_SYNC_MODE_RANK:
      return ADULT_SYNC_RANK_FIELDS;
    case ADULT_SYNC_MODE_DATE:
      return ADULT_SYNC_DATE_FIELDS;
    case ADULT_SYNC_MODE_LIGHT:
      return ADULT_SYNC_LIGHT_FIELDS;
    default:
      return [];
  }
}
