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
 * 公開CTA用: FANZA TV 登録アフィリエイトURL（全作品共通・CIDなし）。
 * NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL のみ使用。未設定・不正時は空文字（ボタン非表示）。
 * Playwright 判定用の content= URL とは分離する。
 */
export function getFanzaTvAffiliateUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_FANZA_TV_AFFILIATE_URL?.trim();
  if (!fromEnv) return "";
  return isValidPublicFanzaTvAffiliateUrl(fromEnv) ? fromEnv : "";
}

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

  const host = parsed.hostname.toLowerCase();

  // 直リンク禁止（計測URL経由必須）
  if (
    host === "tv.dmm.co.jp" ||
    host === "premium.fanza.jp" ||
    host.endsWith(".premium.fanza.jp") ||
    host === "premium.dmm.co.jp"
  ) {
    return false;
  }

  // 作品CID判定URLは公開CTA禁止
  if (urlContainsContentParam(parsed)) {
    return false;
  }

  // DMM/FANZA アフィリエイト計測ドメイン必須
  if (host !== "al.fanza.co.jp" && host !== "al.dmm.co.jp") {
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
    // lurl が tv.dmm / premium.fanza 直指定でも計測経由ならOK（最終遷移先）
    // content= 付きのみ拒否
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
