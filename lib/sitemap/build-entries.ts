import { legalLinks } from "@/lib/site-config";
import { getAllArticles } from "@/data/articles";
import {
  getActressSummaries,
  getCatalogWorks,
  getGenreSummaries,
  getLabelSummaries,
  getMakerSummaries,
  getSeriesSummaries,
} from "@/lib/catalog";
import {
  buildSitemapUrl,
  dedupeSitemapEntries,
  formatSitemapLastmod,
  getItemLastmod,
  SITEMAP_EXCLUDED_PATHS,
} from "@/lib/sitemap/helpers";
import type { SitemapEntry } from "@/lib/sitemap/types";

function isIncludedPath(path: string): boolean {
  return !path.includes("?") && !SITEMAP_EXCLUDED_PATHS.has(path);
}

const STATIC_LASTMOD = formatSitemapLastmod(new Date());

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const [items, actresses, makers, series, labels, genres] =
    await Promise.all([
      getCatalogWorks(),
      getActressSummaries(),
      getMakerSummaries(),
      getSeriesSummaries(),
      getLabelSummaries(),
      getGenreSummaries(),
    ]);

  const staticPaths = [
    "",
    "/works",
    "/actresses",
    "/makers",
    "/labels",
    "/series",
    "/genres",
    "/search",
    "/articles",
    "/about",
    "/faq",
    ...legalLinks
      .map((link) => link.href)
      .filter((href) => !SITEMAP_EXCLUDED_PATHS.has(href)),
  ];

  const entries: SitemapEntry[] = [
    ...staticPaths.filter(isIncludedPath).map((path) => ({
      loc: buildSitemapUrl(path),
      lastmod: STATIC_LASTMOD,
    })),
    ...items.map((item) => ({
      loc: buildSitemapUrl(`/works/${item.content_id}`),
      lastmod: getItemLastmod(item.date),
    })),
    ...actresses.map((actress) => ({
      loc: buildSitemapUrl(`/actresses/${actress.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...makers.map((maker) => ({
      loc: buildSitemapUrl(`/makers/${maker.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...series.map((entry) => ({
      loc: buildSitemapUrl(`/series/${entry.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...labels.map((label) => ({
      loc: buildSitemapUrl(`/labels/${label.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...genres.map((genre) => ({
      loc: buildSitemapUrl(`/genres/${genre.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...getAllArticles().map((article) => ({
      loc: buildSitemapUrl(`/articles/${article.slug}`),
      lastmod: article.updatedAt ?? article.publishedAt,
    })),
  ];

  return dedupeSitemapEntries(entries);
}

/** @deprecated getSitemapEntries を使用してください */
export async function getSitemapUrls(): Promise<string[]> {
  const entries = await getSitemapEntries();
  return entries.map((entry) => entry.loc);
}
