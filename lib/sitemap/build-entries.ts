import { legalLinks } from "@/lib/site-config";
import {
  getMakerDetailPath,
  getSeriesDetailPath,
  getGenreDetailPath,
  getLabelDetailPath,
} from "@/lib/entities/paths";
import { getAllArticles } from "@/data/articles";
import { getCatalogWorks } from "@/lib/catalog";
import {
  readCommittedActressIndex,
  readCommittedGenreIndex,
  readCommittedLabelIndex,
  readCommittedMakerIndex,
  readCommittedSeriesIndex,
} from "@/lib/dmm/catalog-index-read";
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
  const [works, actresses, makers, series, labels, genres] = await Promise.all([
    getCatalogWorks(),
    Promise.resolve(readCommittedActressIndex()),
    Promise.resolve(readCommittedMakerIndex()),
    Promise.resolve(readCommittedSeriesIndex()),
    Promise.resolve(readCommittedLabelIndex()),
    Promise.resolve(readCommittedGenreIndex()),
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
    ...works.map((item) => ({
      loc: buildSitemapUrl(`/works/${item.content_id}`),
      lastmod: getItemLastmod(item.date),
    })),
    ...actresses.map((actress) => ({
      loc: buildSitemapUrl(`/actresses/${actress.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
    ...makers.map((maker) => ({
      loc: buildSitemapUrl(getMakerDetailPath(maker.slug)),
      lastmod: STATIC_LASTMOD,
    })),
    ...series.map((entry) => ({
      loc: buildSitemapUrl(getSeriesDetailPath(entry.slug)),
      lastmod: STATIC_LASTMOD,
    })),
    ...labels.map((label) => ({
      loc: buildSitemapUrl(getLabelDetailPath(label.slug)),
      lastmod: STATIC_LASTMOD,
    })),
    ...genres.map((genre) => ({
      loc: buildSitemapUrl(getGenreDetailPath(genre.slug)),
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
