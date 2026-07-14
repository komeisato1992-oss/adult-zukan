import type { DmmItem } from "@/lib/dmm/types";
import {
  DMM_API_AFFILIATE_ID_FALLBACK,
  FANZA_LINK_AFFILIATE_ID,
} from "@/lib/dmm/constants";

/** 公開CTAで許可するアフィリエイトID */
const REQUIRED_FANZA_TV_AF_ID = "zukanjp-001";

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
 * 公開CTA用: FANZA TV サービス登録アフィリエイトURL（全作品共通・CIDなし）。
 * DMMアフィリエイト管理画面で発行した正式URLを
 * NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL に設定すること。
 * 未設定・不正時は空文字（ボタン非表示）。推測生成しない。
 */
export function getFanzaTvAffiliateUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL?.trim();
  if (!fromEnv) {
    return "";
  }
  return isValidPublicFanzaTvAffiliateUrl(fromEnv) ? fromEnv : "";
}

/** 公開ボタン向け。作品判定用 content= URL・通常直リンク・推測生成を拒否する */
function isValidPublicFanzaTvAffiliateUrl(url: string): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  // 最終遷移先の直リンク禁止（計測URL経由必須）
  const host = parsed.hostname.toLowerCase();
  if (
    host === "tv.dmm.co.jp" ||
    host === "premium.fanza.jp" ||
    host.endsWith(".premium.fanza.jp")
  ) {
    return false;
  }

  // 作品CID判定URLは公開CTA禁止
  if (urlContainsContentParam(parsed)) {
    return false;
  }

  // DMMアフィリエイト計測ドメイン必須（zukanjp-001）
  if (host !== "al.dmm.co.jp") {
    return false;
  }

  const afId = parsed.searchParams.get("af_id")?.trim();
  if (afId !== REQUIRED_FANZA_TV_AF_ID) {
    return false;
  }

  const lurl = parsed.searchParams.get("lurl")?.trim();
  if (!lurl) {
    return false;
  }

  try {
    const target = new URL(lurl);
    if (urlContainsContentParam(target)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function urlContainsContentParam(parsed: URL): boolean {
  if (parsed.searchParams.has("content")) {
    return true;
  }
  try {
    const decoded = decodeURIComponent(parsed.toString());
    return /[?&]content=/i.test(decoded);
  } catch {
    return /[?&]content=/i.test(parsed.toString());
  }
}
