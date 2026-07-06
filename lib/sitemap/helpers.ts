import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

type SitemapEntry = MetadataRoute.Sitemap[number];

/** サイトマップ用の絶対URLを生成（非ASCII文字はパーセントエンコード） */
export function buildSitemapUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

/** 不正な日付を除外 */
export function safeLastModified(
  value: string | Date | undefined,
  fallback: Date,
): Date {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/** URL重複を除去（先勝ち） */
export function dedupeSitemapEntries(
  entries: SitemapEntry[],
): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const result: SitemapEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    result.push(entry);
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
