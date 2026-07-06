import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { legalLinks } from "@/lib/site-config";
import { getAllWorks } from "@/lib/works/repository";
import { getAllActresses } from "@/data/actresses";
import { getAllGenres } from "@/data/genres";
import { getAllMakers } from "@/data/makers";
import { getAllSeries } from "@/data/series";
import { getAllLabels } from "@/data/labels";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const works = await getAllWorks();
  const actresses = getAllActresses();
  const genres = getAllGenres();
  const makers = getAllMakers();
  const series = getAllSeries();
  const labels = getAllLabels();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/works`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/works?sale=1`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/ranking/works`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking/actresses`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking/makers`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking/series`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking/weekly`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/ranking/monthly`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/actresses`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/makers`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/labels`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/series`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/genres`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/sitemap`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/favorites`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/history`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/feed.xml`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    ...legalLinks.map((link) => ({
      url: `${SITE_URL}${link.href}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  const workPages = works.map((work) => ({
    url: `${SITE_URL}/works/${work.slug}`,
    lastModified: new Date(work.releaseDate || now),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const actressPages = actresses.map((actress) => ({
    url: `${SITE_URL}/actresses/${actress.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const genrePages = genres.map((genre) => ({
    url: `${SITE_URL}/genres/${genre.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const makerPages = makers.map((maker) => ({
    url: `${SITE_URL}/makers/${maker.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const seriesPages = series.map((s) => ({
    url: `${SITE_URL}/series/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const labelPages = labels.map((label) => ({
    url: `${SITE_URL}/labels/${label.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...workPages,
    ...actressPages,
    ...genrePages,
    ...makerPages,
    ...seriesPages,
    ...labelPages,
  ];
}
