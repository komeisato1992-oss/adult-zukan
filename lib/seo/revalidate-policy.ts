/**
 * ISR 間隔の一元管理。
 * LONG_WORK_ISR_ENABLED=false で作品詳細を 86400 に戻せる（一時フラグ）。
 */
import { isLongWorkIsrEnabled } from "@/lib/doujin/cost-flags";

/** 作品詳細: 既定 7日 */
export function getWorkDetailRevalidateSec(): number {
  return isLongWorkIsrEnabled() ? 604_800 : 86_400;
}

export const RANKING_REVALIDATE_SEC = 21_600; // 6時間
export const SEARCH_REVALIDATE_SEC = 21_600; // 使わない場合あり
export const SITEMAP_REVALIDATE_SEC = 86_400; // 24時間
