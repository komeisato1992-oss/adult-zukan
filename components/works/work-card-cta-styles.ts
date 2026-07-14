export const WORK_CARD_CTA_HEIGHT =
  "h-10 max-[768px]:h-10 max-[768px]:min-h-[40px]";
export const WORK_CARD_CTA_TEXT =
  "text-[13px] font-semibold sm:text-sm max-[768px]:text-[11px] min-[390px]:max-[768px]:text-[11px]";
export const WORK_CARD_CTA_ROUNDED = "rounded-lg max-[768px]:rounded-md";
export const WORK_CARD_CTA_NOWRAP = "whitespace-nowrap";

export const WORK_CARD_COMPARE_LABEL = "比較に追加+";
export const WORK_CARD_COMPARE_LABEL_MOBILE = "比較＋";
export const WORK_CARD_COMPARE_ACTIVE_LABEL = "✓ 比較中";
export const WORK_CARD_VIEW_LABEL = "作品を見る";
export const WORK_CARD_VIEW_LABEL_MOBILE = "作品を見る";

export const workCardCtaBaseClassName = `inline-flex ${WORK_CARD_CTA_HEIGHT} w-full min-w-0 items-center justify-center ${WORK_CARD_CTA_NOWRAP} ${WORK_CARD_CTA_ROUNDED} px-1.5 sm:px-2 max-[768px]:px-1 ${WORK_CARD_CTA_TEXT}`;

/**
 * 同人カード用 CTA。
 * モバイル(≤768px)はアダルト図鑑と同サイズ感、PC(≥769px)は従来のタップ領域を維持。
 */
export const doujinWorkCardCtaBaseClassName = `inline-flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1.5 sm:px-2 text-[13px] font-semibold sm:text-sm max-[768px]:h-10 max-[768px]:min-h-[40px] max-[768px]:rounded-md max-[768px]:px-1 max-[768px]:text-[11px]`;