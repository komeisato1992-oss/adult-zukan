import "server-only";

import { getCatalogWorkByContentId } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/constants";
import { createEmptySeoCache } from "@/lib/admin/seo-cache-json";
import {
  aggregateAnalyticsRows,
  buildCrawlErrorGroups,
  fetchDailySearchAnalytics,
  fetchPageSearchAnalytics,
  fetchQuerySearchAnalytics,
  fetchSitemaps,
  getSearchConsoleSiteUrl,
  mapDailyRows,
  mapPageRows,
  mapQueryRows,
  mapSitemapRows,
} from "@/lib/admin/google-search-console";
import {
  getGoogleAccessToken,
} from "@/lib/admin/google-service-account";
import { getSeoConfigStatus } from "@/lib/admin/seo-config";
import { loadSeoCache, saveSeoCache } from "@/lib/admin/seo-cache-store";
import {
  buildSeoEnvDiagnostics,
  logSeoGscConnectionResult,
  type SeoEnvDiagnostics,
} from "@/lib/admin/seo-env-diagnostics";
import { getPublishedWorkCount } from "@/lib/admin/stats";
import { getSitemapEntries } from "@/lib/sitemap/build-entries";
import type {
  SeoAiSuggestion,
  SeoCachePayload,
  SeoPageRow,
  SeoPageType,
} from "@/lib/admin/seo-types";

function classifyPageType(pathname: string): SeoPageType {
  if (pathname.startsWith("/works/")) return "work";
  if (pathname.startsWith("/actresses/")) return "actress";
  if (pathname.startsWith("/makers/")) return "maker";
  if (pathname.startsWith("/genres/")) return "genre";
  if (pathname.startsWith("/series/")) return "series";
  if (pathname.startsWith("/labels/")) return "label";
  if (pathname.startsWith("/ranking")) return "ranking";
  return "other";
}

function extractPathname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

async function resolvePageTitle(url: string, pathname: string): Promise<string> {
  if (pathname.startsWith("/works/")) {
    const contentId = decodeURIComponent(pathname.replace("/works/", ""));
    const work = await getCatalogWorkByContentId(contentId);
    if (work?.title) return work.title;
  }

  const segments = pathname.split("/").filter(Boolean);
  const slug = segments.at(-1);
  if (!slug) return url;

  const decoded = decodeURIComponent(slug).replace(/-/g, " ");
  if (pathname.startsWith("/ranking")) {
    return `ランキング: ${decoded}`;
  }

  return decoded;
}

async function enrichPageRows(
  rows: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
): Promise<SeoPageRow[]> {
  const enriched: SeoPageRow[] = [];

  for (const row of rows) {
    const pathname = extractPathname(row.url);
    const title = await resolvePageTitle(row.url, pathname);
    enriched.push({
      ...row,
      title,
      pageType: classifyPageType(pathname),
    });
  }

  return enriched;
}

function buildIndexHistory(
  dailyStats: SeoCachePayload["dailyStats"],
  indexedPages: number,
  totalSitePages: number,
): SeoCachePayload["index"]["history"] {
  const excludedPages = Math.max(totalSitePages - indexedPages, 0);
  const notIndexedPages = Math.max(totalSitePages - indexedPages - excludedPages, 0);

  const history = dailyStats.map((stat) => ({
    date: stat.date,
    indexedPages: stat.indexedPages ?? indexedPages,
    notIndexedPages,
    excludedPages,
  }));

  if (history.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    history.push({
      date: today,
      indexedPages,
      notIndexedPages,
      excludedPages,
    });
  }

  return history;
}

function buildAiSuggestions(
  overview: SeoCachePayload["overview"],
  queries: SeoCachePayload["queries"],
  pages: SeoCachePayload["pages"],
): SeoAiSuggestion[] {
  const suggestions: SeoAiSuggestion[] = [];
  const now = new Date().toISOString();

  const topQuery = queries[0];
  if (topQuery && topQuery.clicks >= 10) {
    suggestions.push({
      id: "top-query",
      severity: "opportunity",
      title: `${topQuery.keyword} の検索流入が多いです`,
      body: "関連コンテンツの追加や内部リンク強化を検討してください。",
      createdAt: now,
    });
  }

  const rankingPage = pages.find((page) => page.pageType === "ranking");
  if (rankingPage && rankingPage.ctr > 0 && rankingPage.ctr < 0.02) {
    suggestions.push({
      id: "ranking-ctr",
      severity: "warning",
      title: "ランキングページのCTRが低めです",
      body: "タイトルやメタディスクリプションの改善を検討してください。",
      createdAt: now,
    });
  }

  if (overview.impressions28d > 0 && overview.clicks28d / overview.impressions28d < 0.015) {
    suggestions.push({
      id: "site-ctr",
      severity: "info",
      title: "サイト全体のCTR改善余地があります",
      body: "人気ページのタイトル最適化と構造化データの見直しを推奨します。",
      createdAt: now,
    });
  }

  return suggestions;
}

export type SeoDashboardData = {
  data: SeoCachePayload;
  envDiagnostics: SeoEnvDiagnostics;
};

export async function getSeoDashboardData(): Promise<SeoDashboardData> {
  const [cache, config, totalWorks, sitemapEntries, envDiagnostics] =
    await Promise.all([
      loadSeoCache(),
      Promise.resolve(getSeoConfigStatus()),
      getPublishedWorkCount(),
      getSitemapEntries(),
      Promise.resolve(buildSeoEnvDiagnostics()),
    ]);

  return {
    envDiagnostics,
    data: {
      ...cache,
      siteUrl: config.gscSiteUrl ?? cache.siteUrl,
      configured: config.configured,
      configMessage: config.configured ? undefined : config.configMessage,
      overview: {
        ...cache.overview,
        totalWorks,
      },
      index: {
        ...cache.index,
        totalSitePages:
          cache.index.totalSitePages > 0
            ? cache.index.totalSitePages
            : sitemapEntries.length,
      },
    },
  };
}

export async function refreshSeoDashboardData(): Promise<SeoCachePayload> {
  const config = getSeoConfigStatus();
  const siteUrl = config.gscSiteUrl ?? getSiteUrl();
  const base = createEmptySeoCache(siteUrl);

  if (!config.configured) {
    logSeoGscConnectionResult({
      success: false,
      error: config.configMessage ?? "認証情報が未設定です",
    });

    const [totalWorks, sitemapEntries] = await Promise.all([
      getPublishedWorkCount(),
      getSitemapEntries(),
    ]);

    const payload: SeoCachePayload = {
      ...base,
      configured: false,
      configMessage: config.configMessage,
      overview: {
        ...base.overview,
        totalWorks,
      },
      index: {
        ...base.index,
        totalSitePages: sitemapEntries.length,
      },
    };

    await saveSeoCache(payload);
    return payload;
  }

  const resolvedSiteUrl = getSearchConsoleSiteUrl();

  try {
    await getGoogleAccessToken();
    console.info("[seo-gsc] Google OAuth token acquired");

    const [
      totalWorks,
      sitemapEntries,
      daily28Rows,
      daily90Rows,
      queryRows,
      pageRows,
      sitemapApiRows,
    ] = await Promise.all([
      getPublishedWorkCount(),
      getSitemapEntries(),
      fetchDailySearchAnalytics(resolvedSiteUrl, 28),
      fetchDailySearchAnalytics(resolvedSiteUrl, 90),
      fetchQuerySearchAnalytics(resolvedSiteUrl, 28),
      fetchPageSearchAnalytics(resolvedSiteUrl, 28),
      fetchSitemaps(resolvedSiteUrl),
    ]);

    const daily28 = mapDailyRows(daily28Rows);
    const daily90 = mapDailyRows(daily90Rows);
    const overviewAgg = aggregateAnalyticsRows(daily28Rows);
    const queries = mapQueryRows(queryRows);
    const pages = await enrichPageRows(mapPageRows(pageRows));
    const sitemaps = mapSitemapRows(sitemapApiRows);
    const crawlErrors = buildCrawlErrorGroups(sitemaps);

    const indexedFromSitemap = sitemaps.reduce(
      (sum, row) => sum + row.indexedCount,
      0,
    );
    const indexedFromPages = new Set(
      pages.filter((page) => page.impressions > 0).map((page) => page.url),
    ).size;
    const indexedPages = Math.max(
      indexedFromSitemap,
      indexedFromPages,
      pages.length > 0 ? pages.length : 0,
    );
    const totalSitePages = sitemapEntries.length;
    const excludedPages = crawlErrors.reduce((sum, group) => sum + group.count, 0);
    const notIndexedPages = Math.max(totalSitePages - indexedPages, 0);

    const dailyStats = (daily90.length > 0 ? daily90 : daily28).map((stat) => ({
      ...stat,
      indexedPages,
    }));

    const indexHistory = buildIndexHistory(
      dailyStats,
      indexedPages,
      totalSitePages,
    );

    const overview = {
      totalWorks,
      indexedPages,
      clicks28d: overviewAgg.clicks,
      impressions28d: overviewAgg.impressions,
      ctr28d: overviewAgg.ctr,
      position28d: overviewAgg.position,
    };

    const payload: SeoCachePayload = {
      version: 1,
      source: "google_search_console",
      siteUrl: resolvedSiteUrl,
      updatedAt: new Date().toISOString(),
      configured: true,
      overview,
      dailyStats,
      queries,
      pages,
      index: {
        indexedPages,
        notIndexedPages,
        excludedPages,
        totalSitePages,
        history: indexHistory,
      },
      sitemaps,
      crawlErrors,
      aiSuggestions: buildAiSuggestions(overview, queries, pages),
    };

    logSeoGscConnectionResult({
      success: true,
      siteUrl: resolvedSiteUrl,
      summary: {
        clicks28d: overview.clicks28d,
        impressions28d: overview.impressions28d,
        queries: queries.length,
        pages: pages.length,
        sitemaps: sitemaps.length,
      },
    });

    await saveSeoCache(payload);
    return payload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search Console API 接続に失敗しました";
    logSeoGscConnectionResult({ success: false, error: message });
    throw error;
  }
}

export function getDefaultSitemapSubmitUrl(): string {
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  return `${siteUrl}/sitemap.xml`;
}

export async function submitDefaultSitemap(): Promise<void> {
  const siteUrl = getSearchConsoleSiteUrl();
  const { submitSitemap } = await import("@/lib/admin/google-search-console");
  await submitSitemap(siteUrl, getDefaultSitemapSubmitUrl());
}
