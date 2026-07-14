import "server-only";

import {
  loadDoujinDashboardCache,
  saveDoujinDashboardCache,
} from "@/lib/admin/doujin-dashboard-cache";
import {
  loadDoujinAuthors,
  loadDoujinCircles,
  loadDoujinGenres,
  loadDoujinSeries,
  loadDoujinWorks,
} from "@/lib/doujin/storage";

export type DoujinAdminDashboardStats = {
  siteType: "doujin";
  workCount: number;
  publishedCount: number;
  unpublishedCount: number;
  saleCount: number;
  circleCount: number;
  authorCount: number;
  seriesCount: number;
  genreCount: number;
  lastFetchedAt: string | null;
  lastUpdatedAt: string | null;
};

export function getDoujinAdminDashboardStats(): DoujinAdminDashboardStats {
  const works = loadDoujinWorks();
  const published = works.filter((work) => work.isPublished !== false);
  const unpublished = works.filter((work) => work.isPublished === false);
  const sale = published.filter((work) => work.isSale);

  const lastFetchedAt =
    works
      .map((work) => work.lastFetchedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const lastUpdatedAt =
    works
      .map((work) => work.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const stats: DoujinAdminDashboardStats = {
    siteType: "doujin",
    workCount: works.length,
    publishedCount: published.length,
    unpublishedCount: unpublished.length,
    saleCount: sale.length,
    circleCount: loadDoujinCircles().length,
    authorCount: loadDoujinAuthors().length,
    seriesCount: loadDoujinSeries().length,
    genreCount: loadDoujinGenres().length,
    lastFetchedAt,
    lastUpdatedAt,
  };

  const existing = loadDoujinDashboardCache();
  saveDoujinDashboardCache({
    stats,
    analytics: existing?.analytics ?? null,
  });

  return stats;
}
