import type { DmmItem } from "@/lib/dmm/types";
import {
  DMM_API_AFFILIATE_ID_FALLBACK,
  FANZA_LINK_AFFILIATE_ID,
} from "@/lib/dmm/constants";

const FANZA_TV_LIST_URL =
  "https://tv.dmm.co.jp/list/?viewing_plans=FANZA_TV";

/** 外部リンク用FANZA URL（API用IDではなく通常アフィリエイトIDを使用） */
export function getDmmFanzaUrl(item: DmmItem): string {
  if (item.URL) {
    return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(item.URL)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
  }

  if (item.affiliateURL) {
    return item.affiliateURL.replace(
      DMM_API_AFFILIATE_ID_FALLBACK,
      FANZA_LINK_AFFILIATE_ID,
    );
  }

  return "";
}

/**
 * FANZA TV（月額見放題）へのアフィリエイトリンク。
 * NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL があればそれを優先。
 * 未設定時は見放題一覧をアフィリエイト経由で開く（作品単位の対象断定はしない）。
 */
export function getFanzaTvAffiliateUrl(contentId?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const target = contentId
    ? `${FANZA_TV_LIST_URL}&content=${encodeURIComponent(contentId)}`
    : FANZA_TV_LIST_URL;

  return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(target)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
}
