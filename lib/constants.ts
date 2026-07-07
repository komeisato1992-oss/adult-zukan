/** 本番の正規ドメイン（NEXT_PUBLIC_SITE_URL 未設定時のフォールバック） */
export const DEFAULT_SITE_URL = "https://adult-zukan.jp";

/** 独自ドメイン移行後に 301 リダイレクトする旧ホスト */
export const LEGACY_SITE_HOSTS = [
  "adult-zukan.vercel.app",
  "adult-zukan.com",
  "www.adult-zukan.com",
] as const;

/**
 * サイトの正規URLを返す。
 * NEXT_PUBLIC_SITE_URL を優先し、未設定時は DEFAULT_SITE_URL を使用する。
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!envUrl || envUrl.includes(".example.com")) {
    return DEFAULT_SITE_URL;
  }

  return envUrl.replace(/\/$/, "");
}

export const SITE_URL = getSiteUrl();

export function getCanonicalHostname(): string {
  return new URL(SITE_URL).hostname;
}

/** 相対パスから正規URLの絶対URLを生成 */
export function buildSiteUrl(path = ""): string {
  if (!path) return SITE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
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
