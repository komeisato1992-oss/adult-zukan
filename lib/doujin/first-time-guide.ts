/**
 * 同人図鑑「初めて利用する方はこちら」導線の表示フラグ。
 * アダルト図鑑には使わない。ENABLE_FIRST_TIME_GUIDE=true のときのみ有効。
 */
export function isDoujinFirstTimeGuideEnabled(): boolean {
  const value = process.env.ENABLE_FIRST_TIME_GUIDE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const DOUJIN_FIRST_TIME_GUIDE_PATH = "/doujin/guide/first-purchase";
export const DOUJIN_FIRST_TIME_FANZA_GO_PATH = "/doujin/guide/fanza";

export function buildDoujinFirstTimeGuideHref(workId: string): string {
  const params = new URLSearchParams({ workId });
  return `${DOUJIN_FIRST_TIME_GUIDE_PATH}?${params.toString()}`;
}

export function buildDoujinFirstTimeFanzaGoHref(workId: string): string {
  const params = new URLSearchParams({ workId });
  return `${DOUJIN_FIRST_TIME_FANZA_GO_PATH}?${params.toString()}`;
}
