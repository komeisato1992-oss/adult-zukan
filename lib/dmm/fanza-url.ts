import type { DmmItem } from "@/lib/dmm/types";
import {
  DMM_API_AFFILIATE_ID_FALLBACK,
  FANZA_LINK_AFFILIATE_ID,
} from "@/lib/dmm/constants";

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
