import { legalLinks } from "@/lib/site-config";
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
  dedupeUrls,
  SITEMAP_EXCLUDED_PATHS,
} from "@/lib/sitemap/helpers";

function isIncludedPath(path: string): boolean {
  return !path.includes("?") && !SITEMAP_EXCLUDED_PATHS.has(path);
}

export async function getSitemapUrls(): Promise<string[]> {
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
    "/ranking",
    "/ranking/works",
    "/ranking/actresses",
    "/ranking/makers",
    "/ranking/series",
    "/ranking/weekly",
    "/ranking/monthly",
    "/search",
    "/actresses",
    "/makers",
    "/labels",
    "/series",
    "/genres",
    "/sitemap",
    "/about",
    "/faq",
    ...legalLinks.map((link) => link.href),
  ];

  const paths = [
    ...staticPaths.filter(isIncludedPath),
    ...items.map((item) => `/works/${item.content_id}`),
    ...actresses.map((actress) => `/actresses/${actress.slug}`),
    ...makers.map((maker) => `/makers/${maker.slug}`),
    ...series.map((entry) => `/series/${entry.slug}`),
    ...labels.map((label) => `/labels/${label.slug}`),
    ...genres.map((genre) => `/genres/${genre.slug}`),
  ];

  return dedupeUrls(paths.map((path) => buildSitemapUrl(path)));
}
