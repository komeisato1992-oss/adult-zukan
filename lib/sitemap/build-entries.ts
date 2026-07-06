import { legalLinks } from "@/lib/site-config";
import {
  getCatalogActresses,
  getCatalogGenres,
  getCatalogItems,
  getCatalogLabels,
  getCatalogMakers,
  getCatalogSeries,
} from "@/lib/dmm/catalog-entities";
import {
  buildSitemapUrl,
  dedupeUrls,
  SITEMAP_EXCLUDED_PATHS,
} from "@/lib/sitemap/helpers";

function isIncludedPath(path: string): boolean {
  return !path.includes("?") && !SITEMAP_EXCLUDED_PATHS.has(path);
}

export async function getSitemapUrls(): Promise<string[]> {
  const items = await getCatalogItems();
  const actresses = getCatalogActresses(items);
  const makers = getCatalogMakers(items);
  const series = getCatalogSeries(items);
  const labels = getCatalogLabels(items);
  const genres = getCatalogGenres(items);

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
