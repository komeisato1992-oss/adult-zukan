import { legalLinks } from "@/lib/site-config";
import { getAllWorks } from "@/lib/works/repository";
import { getAllActresses } from "@/data/actresses";
import { getAllGenres } from "@/data/genres";
import { getAllMakers } from "@/data/makers";
import { getAllSeries } from "@/data/series";
import { getAllLabels } from "@/data/labels";
import {
  buildSitemapUrl,
  dedupeUrls,
  SITEMAP_EXCLUDED_PATHS,
} from "@/lib/sitemap/helpers";

function isIncludedPath(path: string): boolean {
  return !path.includes("?") && !SITEMAP_EXCLUDED_PATHS.has(path);
}

export async function getSitemapUrls(): Promise<string[]> {
  const works = await getAllWorks();
  const actresses = getAllActresses();
  const genres = getAllGenres();
  const makers = getAllMakers();
  const series = getAllSeries();
  const labels = getAllLabels();

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
    ...works.map((work) => `/works/${work.slug}`),
    ...actresses.map((actress) => `/actresses/${actress.slug}`),
    ...genres.map((genre) => `/genres/${genre.slug}`),
    ...makers.map((maker) => `/makers/${maker.slug}`),
    ...series.map((s) => `/series/${s.slug}`),
    ...labels.map((label) => `/labels/${label.slug}`),
  ];

  return dedupeUrls(paths.map((path) => buildSitemapUrl(path)));
}
