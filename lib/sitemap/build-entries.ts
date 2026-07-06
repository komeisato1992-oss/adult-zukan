import type { MetadataRoute } from "next";
import { legalLinks } from "@/lib/site-config";
import { getAllWorks } from "@/lib/works/repository";
import { getAllActresses } from "@/data/actresses";
import { getAllGenres } from "@/data/genres";
import { getAllMakers } from "@/data/makers";
import { getAllSeries } from "@/data/series";
import { getAllLabels } from "@/data/labels";
import {
  buildSitemapUrl,
  dedupeSitemapEntries,
  safeLastModified,
  SITEMAP_EXCLUDED_PATHS,
} from "@/lib/sitemap/helpers";

type SitemapEntry = MetadataRoute.Sitemap[number];

function entry(
  path: string,
  lastModified: Date,
  changeFrequency: SitemapEntry["changeFrequency"],
  priority: number,
): SitemapEntry {
  return {
    url: buildSitemapUrl(path),
    lastModified,
    changeFrequency,
    priority,
  };
}

export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const works = await getAllWorks();
  const actresses = getAllActresses();
  const genres = getAllGenres();
  const makers = getAllMakers();
  const series = getAllSeries();
  const labels = getAllLabels();
  const now = new Date();

  const staticPaths: {
    path: string;
    changeFrequency: SitemapEntry["changeFrequency"];
    priority: number;
  }[] = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/works", changeFrequency: "daily", priority: 0.9 },
    { path: "/ranking", changeFrequency: "daily", priority: 0.9 },
    { path: "/ranking/works", changeFrequency: "daily", priority: 0.85 },
    { path: "/ranking/actresses", changeFrequency: "daily", priority: 0.85 },
    { path: "/ranking/makers", changeFrequency: "daily", priority: 0.85 },
    { path: "/ranking/series", changeFrequency: "daily", priority: 0.85 },
    { path: "/ranking/weekly", changeFrequency: "daily", priority: 0.85 },
    { path: "/ranking/monthly", changeFrequency: "daily", priority: 0.85 },
    { path: "/search", changeFrequency: "weekly", priority: 0.8 },
    { path: "/actresses", changeFrequency: "weekly", priority: 0.8 },
    { path: "/makers", changeFrequency: "weekly", priority: 0.8 },
    { path: "/labels", changeFrequency: "weekly", priority: 0.8 },
    { path: "/series", changeFrequency: "weekly", priority: 0.8 },
    { path: "/genres", changeFrequency: "weekly", priority: 0.8 },
    { path: "/sitemap", changeFrequency: "monthly", priority: 0.5 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
    ...legalLinks.map((link) => ({
      path: link.href,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  const staticPages = staticPaths
    .filter(({ path }) => !SITEMAP_EXCLUDED_PATHS.has(path))
    .map(({ path, changeFrequency, priority }) =>
      entry(path, now, changeFrequency, priority),
    );

  const workPages = works.map((work) =>
    entry(
      `/works/${work.slug}`,
      safeLastModified(work.releaseDate, now),
      "monthly",
      0.7,
    ),
  );

  const actressPages = actresses.map((actress) =>
    entry(`/actresses/${actress.slug}`, now, "weekly", 0.65),
  );

  const genrePages = genres.map((genre) =>
    entry(`/genres/${genre.slug}`, now, "weekly", 0.65),
  );

  const makerPages = makers.map((maker) =>
    entry(`/makers/${maker.slug}`, now, "weekly", 0.65),
  );

  const seriesPages = series.map((s) =>
    entry(`/series/${s.slug}`, now, "weekly", 0.65),
  );

  const labelPages = labels.map((label) =>
    entry(`/labels/${label.slug}`, now, "weekly", 0.6),
  );

  return dedupeSitemapEntries([
    ...staticPages,
    ...workPages,
    ...actressPages,
    ...genrePages,
    ...makerPages,
    ...seriesPages,
    ...labelPages,
  ]);
}
