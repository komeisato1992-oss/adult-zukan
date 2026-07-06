export const DEFAULT_SITE_URL = "https://adult-zukan.vercel.app";

/**
 * サイトの正規URLを返す。
 * NEXT_PUBLIC_SITE_URL が未設定、または旧ダミードメインの場合は Vercel URL を使用する。
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!envUrl || envUrl.includes(".example.com")) {
    return DEFAULT_SITE_URL;
  }

  return envUrl.replace(/\/$/, "");
}

export const SITE_URL = getSiteUrl();
