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
import type { DmmItem } from "@/lib/dmm/types";
import {
  buildSitemapDefinitions,
  getWorksChunkPathnames,
  SITEMAP_WORKS_CHUNK_SIZE,
  type SitemapDefinition,
} from "@/lib/sitemap/definitions";
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

function getWorkLastmod(item: DmmItem): string {
  if (item.addedAt?.trim()) {
    const added = new Date(item.addedAt);
    if (!Number.isNaN(added.getTime())) {
      return formatSitemapLastmod(added);
    }
  }
  return getItemLastmod(item.date);
}

export async function getStaticSitemapEntries(): Promise<SitemapEntry[]> {
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
    ...getAllArticles().map((article) => ({
      loc: buildSitemapUrl(`/articles/${article.slug}`),
      lastmod: article.updatedAt ?? article.publishedAt,
    })),
  ];

  return dedupeSitemapEntries(entries);
}

export async function getWorksSitemapEntries(
  chunkIndex = 0,
): Promise<SitemapEntry[]> {
  const works = await getCatalogWorks();
  const start = chunkIndex * SITEMAP_WORKS_CHUNK_SIZE;
  const end = start + SITEMAP_WORKS_CHUNK_SIZE;
  const slice = works.slice(start, end);

  return dedupeSitemapEntries(
    slice.map((item) => ({
      loc: buildSitemapUrl(`/works/${item.content_id}`),
      lastmod: getWorkLastmod(item),
    })),
  );
}

export async function getActressSitemapEntries(): Promise<SitemapEntry[]> {
  const actresses = readCommittedActressIndex();
  return dedupeSitemapEntries(
    actresses.map((actress) => ({
      loc: buildSitemapUrl(`/actresses/${actress.slug}`),
      lastmod: STATIC_LASTMOD,
    })),
  );
}

export async function getMakerSitemapEntries(): Promise<SitemapEntry[]> {
  const makers = readCommittedMakerIndex();
  return dedupeSitemapEntries(
    makers.map((maker) => ({
      loc: buildSitemapUrl(getMakerDetailPath(maker.slug)),
      lastmod: STATIC_LASTMOD,
    })),
  );
}

export async function getSeriesSitemapEntries(): Promise<SitemapEntry[]> {
  const series = readCommittedSeriesIndex();
  return dedupeSitemapEntries(
    series.map((entry) => ({
      loc: buildSitemapUrl(getSeriesDetailPath(entry.slug)),
      lastmod: STATIC_LASTMOD,
    })),
  );
}

export async function getLabelSitemapEntries(): Promise<SitemapEntry[]> {
  const labels = readCommittedLabelIndex();
  return dedupeSitemapEntries(
    labels.map((label) => ({
      loc: buildSitemapUrl(getLabelDetailPath(label.slug)),
      lastmod: STATIC_LASTMOD,
    })),
  );
}

export async function getGenreSitemapEntries(): Promise<SitemapEntry[]> {
  const genres = readCommittedGenreIndex();
  return dedupeSitemapEntries(
    genres.map((genre) => ({
      loc: buildSitemapUrl(getGenreDetailPath(genre.slug)),
      lastmod: STATIC_LASTMOD,
    })),
  );
}

export async function getSitemapIndexEntries(): Promise<SitemapEntry[]> {
  const works = await getCatalogWorks();
  const now = formatSitemapLastmod(new Date());
  const childDefinitions = buildSitemapDefinitions({
    worksCount: works.length,
  }).filter((definition) => definition.kind === "urlset");

  return childDefinitions.map((definition) => ({
    loc: definition.url,
    lastmod: now,
  }));
}

export async function getSitemapEntriesForDefinition(
  definition: SitemapDefinition,
): Promise<SitemapEntry[]> {
  switch (definition.entityKey) {
    case "static":
      return getStaticSitemapEntries();
    case "works": {
      const match = definition.pathname.match(/works(?:-(\d+))?\.xml$/);
      const chunkNumber = match?.[1] ? Number.parseInt(match[1], 10) : 1;
      return getWorksSitemapEntries(chunkNumber - 1);
    }
    case "actresses":
      return getActressSitemapEntries();
    case "makers":
      return getMakerSitemapEntries();
    case "labels":
      return getLabelSitemapEntries();
    case "series":
      return getSeriesSitemapEntries();
    case "genres":
      return getGenreSitemapEntries();
    default:
      return [];
  }
}

export async function getSitemapEntriesForFilename(
  filename: string,
): Promise<SitemapEntry[]> {
  const works = await getCatalogWorks();
  const pathname = filename.startsWith("/") ? filename : `/sitemaps/${filename}`;
  const definition = buildSitemapDefinitions({ worksCount: works.length }).find(
    (entry) => entry.pathname === pathname,
  );

  if (!definition) {
    return [];
  }

  return getSitemapEntriesForDefinition(definition);
}

/** 旧API互換: 全URLを1つの urlset として返す */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const works = await getCatalogWorks();
  const chunkPathnames = getWorksChunkPathnames(works.length);
  const [
    staticEntries,
    actressEntries,
    makerEntries,
    seriesEntries,
    labelEntries,
    genreEntries,
  ] = await Promise.all([
    getStaticSitemapEntries(),
    getActressSitemapEntries(),
    getMakerSitemapEntries(),
    getSeriesSitemapEntries(),
    getLabelSitemapEntries(),
    getGenreSitemapEntries(),
  ]);

  const workChunks = await Promise.all(
    chunkPathnames.map((_pathname, index) => getWorksSitemapEntries(index)),
  );

  return dedupeSitemapEntries([
    ...staticEntries,
    ...workChunks.flat(),
    ...actressEntries,
    ...makerEntries,
    ...seriesEntries,
    ...labelEntries,
    ...genreEntries,
  ]);
}

/** @deprecated getSitemapEntries を使用してください */
export async function getSitemapUrls(): Promise<string[]> {
  const entries = await getSitemapEntries();
  return entries.map((entry) => entry.loc);
}

export async function countSitemapEntriesByKey(
  key: string,
): Promise<number> {
  const works = await getCatalogWorks();
  const definition = buildSitemapDefinitions({ worksCount: works.length }).find(
    (entry) => entry.key === key,
  );
  if (!definition) return 0;
  const entries = await getSitemapEntriesForDefinition(definition);
  return entries.length;
}
