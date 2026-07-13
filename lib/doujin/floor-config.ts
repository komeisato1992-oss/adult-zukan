import "server-only";

/**
 * 同人図鑑向け DMM フロア設定。
 * 未設定のまま取得を実行しない（管理画面で明示エラー）。
 */
export type DoujinFloorConfig = {
  site: string;
  service: string;
  floor: string;
};

export const DOUJIN_FLOOR_ENV_KEYS = [
  "DMM_DOUJIN_SITE",
  "DMM_DOUJIN_SERVICE",
  "DMM_DOUJIN_FLOOR",
] as const;

/** FloorList で確認した推奨値（環境変数のプレースホルダ用。自動適用はしない） */
export const DOUJIN_RECOMMENDED_FLOOR = {
  site: "FANZA",
  service: "doujin",
  floor: "digital_doujin",
} as const;

export function readDoujinFloorEnv(): Partial<DoujinFloorConfig> {
  return {
    site: process.env.DMM_DOUJIN_SITE?.trim() || undefined,
    service: process.env.DMM_DOUJIN_SERVICE?.trim() || undefined,
    floor: process.env.DMM_DOUJIN_FLOOR?.trim() || undefined,
  };
}

export function resolveDoujinFloorConfig(
  overrides: Partial<DoujinFloorConfig> = {},
):
  | { ok: true; config: DoujinFloorConfig }
  | { ok: false; error: string; missing: string[] } {
  const env = readDoujinFloorEnv();
  const site = overrides.site?.trim() || env.site;
  const service = overrides.service?.trim() || env.service;
  const floor = overrides.floor?.trim() || env.floor;

  const missing: string[] = [];
  if (!site) missing.push("DMM_DOUJIN_SITE（または入力の site）");
  if (!service) missing.push("DMM_DOUJIN_SERVICE（または入力の service）");
  if (!floor) missing.push("DMM_DOUJIN_FLOOR（または入力の floor）");

  if (missing.length > 0) {
    return {
      ok: false,
      error: `同人フロア設定が未設定です: ${missing.join("、")}`,
      missing,
    };
  }

  return {
    ok: true,
    config: { site: site!, service: service!, floor: floor! },
  };
}

export const DOUJIN_ITEMLIST_MAX_HITS = 100;
export const DOUJIN_ITEMLIST_MAX_OFFSET = 50_000;
export const DOUJIN_FETCH_MAX_TOTAL = 500;
export const DOUJIN_FETCH_CONCURRENCY = 1;
