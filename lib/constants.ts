/** 本番の正規ドメイン（NEXT_PUBLIC_SITE_URL 未設定時のフォールバック） */
export const DEFAULT_SITE_URL = "https://adult-zukan.jp";

/** 独自ドメイン移行後に 301 リダイレクトする旧ホスト */
export const LEGACY_SITE_HOSTS = [
  "adult-zukan.vercel.app",
  "adult-zukan.com",
  "www.adult-zukan.com",
] as const;

/** www 付きホストを正規ホストへリダイレクトする */
export function isWwwVariantHost(host: string, canonicalHost: string): boolean {
  return host === `www.${canonicalHost}`;
}

/**
 * 正規 URL から www を除去する（パス・クエリ・ハッシュは保持）。
 * ルート（`/`）はオリジンのみ（末尾スラッシュなし）を返す。
 */
export function normalizeSiteUrl(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname.startsWith("www.")) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  const pathname =
    parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");

  return `${parsed.origin}${pathname}${parsed.search}${parsed.hash}`;
}

/**
 * サイトの正規URLを返す。
 * NEXT_PUBLIC_SITE_URL を優先し、未設定時は DEFAULT_SITE_URL を使用する。
 * いずれも www なし（https://adult-zukan.jp）に正規化する。
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!envUrl || envUrl.includes(".example.com")) {
    return DEFAULT_SITE_URL;
  }

  return normalizeSiteUrl(envUrl);
}

export const SITE_URL = getSiteUrl();

export function getCanonicalHostname(): string {
  return new URL(SITE_URL).hostname;
}

/** 相対パスから正規URLの絶対URLを生成 */
export function buildSiteUrl(path = ""): string {
  const base = SITE_URL.replace(/\/$/, "");
  if (!path) return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function isLocalDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
  );
}
