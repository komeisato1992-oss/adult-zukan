import type { MetadataRoute } from "next";
import { siteConfig, legalLinks } from "@/lib/site-config";
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
    { url: siteConfig.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteConfig.url}/works`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/works?sale=1`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/ranking/works`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking/actresses`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking/makers`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking/series`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking/weekly`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/ranking/monthly`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteConfig.url}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/actresses`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/makers`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/labels`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/series`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/genres`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/sitemap`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteConfig.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteConfig.url}/favorites`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${siteConfig.url}/history`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${siteConfig.url}/feed.xml`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    ...legalLinks.map((link) => ({
      url: `${siteConfig.url}${link.href}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  const workPages = works.map((work) => ({
    url: `${siteConfig.url}/works/${work.slug}`,
    lastModified: new Date(work.releaseDate || now),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const actressPages = actresses.map((actress) => ({
    url: `${siteConfig.url}/actresses/${actress.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const genrePages = genres.map((genre) => ({
    url: `${siteConfig.url}/genres/${genre.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const makerPages = makers.map((maker) => ({
    url: `${siteConfig.url}/makers/${maker.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const seriesPages = series.map((s) => ({
    url: `${siteConfig.url}/series/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const labelPages = labels.map((label) => ({
    url: `${siteConfig.url}/labels/${label.slug}`,
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
