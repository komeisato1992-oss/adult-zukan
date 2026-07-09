import { normalizeSiteUrl, SITE_URL } from "@/lib/constants";
import type { SitemapEntry } from "@/lib/sitemap/types";

/** サイトマップ用の絶対URLを生成（canonical と同じ未エンコードパスを使用） */
export function buildSitemapUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalizeSiteUrl(`${SITE_URL}${normalized}`);
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

/** サイトマップエントリの重複を除去（先勝ち） */
export function dedupeSitemapEntries(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>();
  const result: SitemapEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    result.push(entry);
  }

  return result;
}

/** ISO 8601 日付（YYYY-MM-DD）に変換 */
export function formatSitemapLastmod(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** DMM作品の date フィールドから lastmod を生成 */
export function getItemLastmod(date?: string): string {
  if (!date?.trim()) return formatSitemapLastmod(new Date());

  const parsed = new Date(date.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return formatSitemapLastmod(new Date());
  }

  return formatSitemapLastmod(parsed);
}

/** サイトマップに含めない noindex ページ・クエリ付きURL */
export const SITEMAP_EXCLUDED_PATHS = new Set([
  "/favorites",
  "/history",
  "/age-denied",
  "/admin",
  "/admin/login",
  "/admin/sns",
  "/feed.xml",
  "/works?sale=1",
  "/sitemap",
]);
