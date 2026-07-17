import type { DmmItem } from "@/lib/dmm/types";
import {
  DMM_API_AFFILIATE_ID_FALLBACK,
  FANZA_LINK_AFFILIATE_ID,
} from "@/lib/dmm/constants";

/** 公開CTAで許可するアフィリエイトID */
const REQUIRED_FANZA_TV_AF_ID = "zukanjp-001";

const AFFILIATE_TRACKER_HOSTS = new Set(["al.dmm.co.jp", "al.fanza.co.jp"]);

const PRODUCT_HOST_SUFFIXES = [
  "video.dmm.co.jp",
  "www.dmm.co.jp",
  "www.dmm.com",
  "dmm.co.jp",
  "dmm.com",
  "fanza.tv",
];

export type ResolveFanzaAffiliateUrlInput = {
  affiliateUrl?: string | null;
  productUrl?: string | null;
  /** ログ用（任意） */
  contentId?: string | null;
};

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isAffiliateTrackerUrl(raw: string): boolean {
  const parsed = tryParseUrl(raw);
  if (!parsed) return false;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  return AFFILIATE_TRACKER_HOSTS.has(parsed.hostname.toLowerCase());
}

function isProductDirectUrl(raw: string): boolean {
  const parsed = tryParseUrl(raw);
  if (!parsed) return false;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  if (AFFILIATE_TRACKER_HOSTS.has(host)) return false;
  return PRODUCT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/** API用 af_id を公開CTA用へ置換（既に公開IDならそのまま） */
function normalizeLinkAffiliateId(affiliateUrl: string): string {
  if (!affiliateUrl.includes(DMM_API_AFFILIATE_ID_FALLBACK)) {
    return affiliateUrl;
  }
  return affiliateUrl.split(DMM_API_AFFILIATE_ID_FALLBACK).join(
    FANZA_LINK_AFFILIATE_ID,
  );
}

function wrapProductUrlOnce(productUrl: string): string {
  return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(productUrl)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
}

function warnInvalidFanzaUrl(
  contentId: string | null | undefined,
  sample: string,
): void {
  console.warn("[fanza-url] invalid or unsupported url; hiding CTA", {
    contentId: contentId?.trim() || null,
    sample: sample.slice(0, 120),
  });
}

/**
 * FANZA「作品を見る」用 URL を生成する共通関数。
 *
 * - すでに al.dmm.co.jp / al.fanza.co.jp → 再ラップせず af_id のみ正規化
 * - video.dmm.co.jp / www.dmm.co.jp 等の商品直リンク → 1回だけアフィリエイト化
 * - 両方なし / 不正 → 空文字（ボタン非表示）
 */
export function resolveFanzaAffiliateUrl(
  input: ResolveFanzaAffiliateUrlInput,
): string {
  const candidates = [input.affiliateUrl, input.productUrl]
    .map((value) => value?.trim() || "")
    .filter(Boolean);

  if (candidates.length === 0) return "";

  for (const raw of candidates) {
    if (isAffiliateTrackerUrl(raw)) {
      return normalizeLinkAffiliateId(raw);
    }
  }

  for (const raw of candidates) {
    if (isProductDirectUrl(raw)) {
      return wrapProductUrlOnce(raw);
    }
  }

  warnInvalidFanzaUrl(input.contentId, candidates[0] ?? "");
  return "";
}

/** 外部リンク用FANZA URL（API用IDではなく通常アフィリエイトIDを使用） */
export function getDmmFanzaUrl(item: DmmItem): string {
  return resolveFanzaAffiliateUrl({
    affiliateUrl: item.affiliateURL,
    productUrl: item.URL,
    contentId: item.content_id,
  });
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
