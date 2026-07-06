import { SITE_URL } from "@/lib/constants";

/** サイトマップ用の絶対URLを生成（非ASCII文字はパーセントエンコード） */
export function buildSitemapUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

/** URL重複を除去（先勝ち） */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  return result;
}

/** サイトマップに含めない noindex ページ・クエリ付きURL */
export const SITEMAP_EXCLUDED_PATHS = new Set([
  "/favorites",
  "/history",
  "/age-denied",
  "/feed.xml",
  "/works?sale=1",
]);
