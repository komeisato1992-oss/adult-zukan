import "server-only";

import { getCatalogWorkByContentId, getCatalogWorks } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/constants";
import { createEmptySeoCache } from "@/lib/admin/seo-cache-json";
import {
  buildCrawlErrorGroups,
  fetchDailySearchAnalytics,
  fetchSearchAnalyticsForRange,
  fetchSitemaps,
  getSearchConsoleSiteUrl,
  mapDailyRows,
  mapPageRows,
  mapQueryRows,
  mapSitemapRows,
  probeSearchConsoleConnection,
} from "@/lib/admin/google-search-console";
import {
  getGoogleAccessToken,
  getServiceAccountEmail,
} from "@/lib/admin/google-service-account";
import { GoogleSearchConsoleError } from "@/lib/admin/google-search-console-errors";
import { getSeoConfigStatus } from "@/lib/admin/seo-config";
import { loadSeoCache, saveSeoCache } from "@/lib/admin/seo-cache-store";
import {
  buildSeoEnvDiagnostics,
  logSeoGscConnectionResult,
  type SeoEnvDiagnostics,
} from "@/lib/admin/seo-env-diagnostics";
import {
  getCurrentPeriodRange,
  getPreviousPeriodRange,
} from "@/lib/admin/seo-period";
import { getPublishedWorkCount } from "@/lib/admin/stats";
import {
  buildEntitySitemapStatuses,
  createEmptySitemapStatusSnapshot,
} from "@/lib/admin/seo-sitemap-status";
import { getSitemapEntries } from "@/lib/sitemap/build-entries";
import {
  readCommittedActressIndex,
  readCommittedGenreIndex,
  readCommittedLabelIndex,
  readCommittedMakerIndex,
  readCommittedSeriesIndex,
} from "@/lib/dmm/catalog-index-read";
import type {
  SeoCachePayload,
  SeoEntityPageCounts,
  SeoNewWorkRow,
  SeoNewWorksSummary,
  SeoPageRow,
  SeoPageType,
  SeoPeriodBundle,
  SeoPeriodDays,
  SeoPeriodMetrics,
} from "@/lib/admin/seo-types";
import { iterateItemActresses } from "@/lib/dmm/actress-names";
import { getDmmItemMakerName } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { slugify } from "@/lib/utils";

const PERIOD_OPTIONS: SeoPeriodDays[] = [7, 28, 90];

async function getEntityPageCounts(totalWorks: number): Promise<SeoEntityPageCounts> {
  return {
    works: totalWorks,
    actresses: readCommittedActressIndex().length,
    makers: readCommittedMakerIndex().length,
    labels: readCommittedLabelIndex().length,
    series: readCommittedSeriesIndex().length,
    genres: readCommittedGenreIndex().length,
  };
}

function classifyPageType(pathname: string): SeoPageType {
  if (pathname.startsWith("/works/")) return "work";
  if (pathname.startsWith("/actresses/")) return "actress";
  if (pathname.startsWith("/makers/")) return "maker";
  if (pathname.startsWith("/genres/")) return "genre";
  if (pathname.startsWith("/series/")) return "series";
  if (pathname.startsWith("/labels/")) return "label";
  if (pathname.startsWith("/ranking")) return "ranking";
  if (pathname.startsWith("/search")) return "search";
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

function aggregateDailySlice(
  dailyStats: SeoCachePayload["dailyStats"],
  startDate: string,
  endDate: string,
): SeoPeriodMetrics {
  const filtered = dailyStats.filter(
    (row) => row.date >= startDate && row.date <= endDate,
  );
  if (filtered.length === 0) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }

  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;

  for (const row of filtered) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

function metricsFromDailyPeriod(
  dailyStats: SeoCachePayload["dailyStats"],
  days: SeoPeriodDays,
  kind: "current" | "previous",
): SeoPeriodMetrics {
  const range =
    kind === "current"
      ? getCurrentPeriodRange(days)
      : getPreviousPeriodRange(days);
  return aggregateDailySlice(dailyStats, range.startDate, range.endDate);
}

async function fetchPeriodBundlePart(
  siteUrl: string,
  days: SeoPeriodDays,
  dailyStats: SeoCachePayload["dailyStats"],
): Promise<SeoPeriodBundle> {
  const currentRange = getCurrentPeriodRange(days);
  const previousRange = getPreviousPeriodRange(days);

  const [currentQueryRows, previousQueryRows, currentPageRows, previousPageRows] =
    await Promise.all([
      fetchSearchAnalyticsForRange(
        siteUrl,
        currentRange.startDate,
        currentRange.endDate,
        ["query"],
        2500,
      ),
      fetchSearchAnalyticsForRange(
        siteUrl,
        previousRange.startDate,
        previousRange.endDate,
        ["query"],
        2500,
      ),
      fetchSearchAnalyticsForRange(
        siteUrl,
        currentRange.startDate,
        currentRange.endDate,
        ["page"],
        2500,
      ),
      fetchSearchAnalyticsForRange(
        siteUrl,
        previousRange.startDate,
        previousRange.endDate,
        ["page"],
        2500,
      ),
    ]);

  const [pages, previousPages] = await Promise.all([
    enrichPageRows(mapPageRows(currentPageRows)),
    enrichPageRows(mapPageRows(previousPageRows)),
  ]);

  return {
    current: metricsFromDailyPeriod(dailyStats, days, "current"),
    previous: metricsFromDailyPeriod(dailyStats, days, "previous"),
    queries: mapQueryRows(currentQueryRows),
    previousQueries: mapQueryRows(previousQueryRows),
    pages,
    previousPages,
  };
}

function buildIndexHistory(
  dailyStats: SeoCachePayload["dailyStats"],
  indexedPages: number | null,
  notIndexedPages: number | null,
  excludedPages: number,
): SeoCachePayload["index"]["history"] {
  if (indexedPages === null) return [];

  return dailyStats.map((stat) => ({
    date: stat.date,
    indexedPages: stat.indexedPages ?? indexedPages,
    notIndexedPages: notIndexedPages ?? 0,
    excludedPages,
  }));
}

function buildEntityWorkCounts(works: DmmItem[]): SeoCachePayload["entityWorkCounts"] {
  const actresses: Record<string, number> = {};
  const makers: Record<string, number> = {};
  const genres: Record<string, number> = {};

  for (const work of works) {
    for (const actress of iterateItemActresses(work)) {
      const key = slugify(actress.name);
      if (!key) continue;
      actresses[key] = (actresses[key] ?? 0) + 1;
    }

    const maker = getDmmItemMakerName(work)?.trim();
    if (maker) {
      const key = slugify(maker);
      makers[key] = (makers[key] ?? 0) + 1;
    }

    for (const genre of work.iteminfo?.genre ?? []) {
      const name = genre.name?.trim();
      if (!name) continue;
      const key = slugify(name);
      genres[key] = (genres[key] ?? 0) + 1;
    }
  }

  return { actresses, makers, genres };
}

function normalizeWorkPageUrl(siteUrl: string, contentId: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/works/${encodeURIComponent(contentId)}`;
}

function findPageMetrics(
  pages: SeoPageRow[],
  targetUrl: string,
): Pick<SeoNewWorkRow, "impressions" | "clicks" | "position" | "status"> {
  const normalizedTarget = targetUrl.replace(/\/$/, "");
  const match = pages.find(
    (page) => page.url.replace(/\/$/, "") === normalizedTarget,
  );

  if (!match) {
    return {
      impressions: 0,
      clicks: 0,
      position: 0,
      status: "pending",
    };
  }

  if (match.impressions > 0 || match.clicks > 0) {
    return {
      impressions: match.impressions,
      clicks: match.clicks,
      position: match.position,
      status: "has_search_data",
    };
  }

  return {
    impressions: 0,
    clicks: 0,
    position: 0,
    status: "no_search_data",
  };
}

function buildNewWorksSummary(
  works: DmmItem[],
  siteUrl: string,
  pages28d: SeoPageRow[],
): SeoNewWorksSummary {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const recentWorks = works
    .filter((work) => work.addedAt)
    .map((work) => ({
      work,
      addedAt: work.addedAt!,
      addedTime: new Date(work.addedAt!).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.addedTime))
    .sort((a, b) => b.addedTime - a.addedTime);

  const added7d = recentWorks.filter(
    (entry) => now - entry.addedTime <= 7 * dayMs,
  ).length;
  const added28d = recentWorks.filter(
    (entry) => now - entry.addedTime <= 28 * dayMs,
  ).length;

  const rows: SeoNewWorkRow[] = recentWorks
    .filter((entry) => now - entry.addedTime <= 28 * dayMs)
    .slice(0, 50)
    .map(({ work, addedAt }) => {
      const url = normalizeWorkPageUrl(siteUrl, work.content_id);
      const metrics = findPageMetrics(pages28d, url);
      return {
        contentId: work.content_id,
        title: work.title,
        addedAt,
        url,
        ...metrics,
      };
    });

  let withSearchData = 0;
  let withoutSearchData = 0;
  for (const row of rows) {
    if (row.status === "has_search_data") withSearchData += 1;
    else withoutSearchData += 1;
  }

  return {
    added7d,
    added28d,
    withSearchData,
    withoutSearchData,
    rows,
  };
}

function resolveIndexCounts(options: {
  indexedFromSitemap: number;
  indexedFromSearchImpressions: number;
  totalSitePages: number;
}): Pick<
  SeoCachePayload["index"],
  "indexedPages" | "notIndexedPages" | "registrationRate" | "indexedSource"
> {
  const { indexedFromSitemap, indexedFromSearchImpressions, totalSitePages } =
    options;

  if (indexedFromSitemap > 0) {
    const notIndexedPages =
      totalSitePages > indexedFromSitemap
        ? totalSitePages - indexedFromSitemap
        : null;
    return {
      indexedPages: indexedFromSitemap,
      notIndexedPages,
      registrationRate:
        totalSitePages > 0 ? indexedFromSitemap / totalSitePages : null,
      indexedSource: "sitemap",
    };
  }

  if (indexedFromSearchImpressions > 0) {
    return {
      indexedPages: indexedFromSearchImpressions,
      notIndexedPages: null,
      registrationRate: null,
      indexedSource: "search_impressions",
    };
  }

  return {
    indexedPages: null,
    notIndexedPages: null,
    registrationRate: null,
    indexedSource: "unavailable",
  };
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

  const totalSitePages =
    cache.index.totalSitePages > 0
      ? cache.index.totalSitePages
      : sitemapEntries.length;

  return {
    envDiagnostics,
    data: {
      ...cache,
      siteUrl: config.gscSiteUrl ?? cache.siteUrl,
      configured: config.configured,
      configMessage: config.configured
        ? cache.stale || cache.fetchError
          ? cache.configMessage
          : undefined
        : (config.configMessage ?? cache.configMessage),
      connectionStatus: !config.configured
        ? "unconfigured"
        : cache.stale || cache.fetchError
          ? "error"
          : cache.connectionStatus === "connected"
            ? "connected"
            : cache.connectionStatus,
      fetchError: cache.fetchError,
      stale: cache.stale,
      overview: {
        ...cache.overview,
        totalWorks,
      },
      index: {
        ...cache.index,
        totalSitePages,
      },
      queries: cache.periods[28]?.queries ?? cache.queries,
      pages: cache.periods[28]?.pages ?? cache.pages,
      sitemapStatus:
        cache.sitemapStatus ??
        createEmptySitemapStatusSnapshot(
          config.gscSiteUrl ?? cache.siteUrl,
          cache.entityPageCounts ?? {
            works: totalWorks,
            actresses: 0,
            makers: 0,
            labels: 0,
            series: 0,
            genres: 0,
          },
          totalWorks,
        ),
    },
  };
}

export async function refreshSeoSitemapsOnly(): Promise<SeoCachePayload> {
  const config = getSeoConfigStatus();
  const cache = await loadSeoCache();
  const siteUrl = config.gscSiteUrl ?? cache.siteUrl ?? getSiteUrl();
  const totalWorks = await getPublishedWorkCount();
  const entityPageCounts = await getEntityPageCounts(totalWorks);

  if (!config.configured) {
    const payload: SeoCachePayload = {
      ...cache,
      siteUrl,
      entityPageCounts,
      sitemapStatus: {
        fetchedAt: null,
        fetchError: config.configMessage ?? "Search Console APIが未設定です。",
        rows: createEmptySitemapStatusSnapshot(siteUrl, entityPageCounts).rows,
      },
    };
    await saveSeoCache(payload);
    return payload;
  }

  const resolvedSiteUrl = getSearchConsoleSiteUrl();

  try {
    const sitemapApiRows = await fetchSitemaps(resolvedSiteUrl);
    const sitemaps = mapSitemapRows(sitemapApiRows);
    const fetchedAt = new Date().toISOString();
    const sitemapStatus = buildEntitySitemapStatuses({
      siteUrl: resolvedSiteUrl,
      gscRows: sitemaps,
      entityPageCounts,
      worksCount: entityPageCounts.works,
      fetchedAt,
    });

    const payload: SeoCachePayload = {
      ...cache,
      siteUrl: resolvedSiteUrl,
      sitemaps,
      sitemapStatus,
      entityPageCounts,
      crawlErrors: buildCrawlErrorGroups(sitemaps),
    };

    await saveSeoCache(payload);
    return payload;
  } catch (error) {
    const message =
      error instanceof GoogleSearchConsoleError
        ? error.message
        : error instanceof Error
          ? error.message
          : "サイトマップ情報の取得に失敗しました。";

    const payload: SeoCachePayload = {
      ...cache,
      siteUrl: resolvedSiteUrl,
      entityPageCounts,
      sitemapStatus: buildEntitySitemapStatuses({
        siteUrl: resolvedSiteUrl,
        gscRows: cache.sitemaps,
        entityPageCounts,
        worksCount: entityPageCounts.works,
        fetchedAt: cache.sitemapStatus?.fetchedAt ?? null,
        fetchError: message,
      }),
    };

    await saveSeoCache(payload);
    return payload;
  }
}

export async function submitEntitySitemap(pathSuffix: string): Promise<void> {
  const siteUrl = getSearchConsoleSiteUrl();
  const { submitSitemap } = await import("@/lib/admin/google-search-console");
  const base = siteUrl.replace(/\/$/, "");
  await submitSitemap(siteUrl, `${base}/${pathSuffix}`);
}

export async function refreshSeoDashboardData(): Promise<SeoCachePayload> {
  const config = getSeoConfigStatus();
  const siteUrl = config.gscSiteUrl ?? getSiteUrl();
  const base = createEmptySeoCache(siteUrl);

  const [totalWorks, sitemapEntries, catalogWorks] = await Promise.all([
    getPublishedWorkCount(),
    getSitemapEntries(),
    getCatalogWorks(),
  ]);

  const entityWorkCounts = buildEntityWorkCounts(catalogWorks);
  const entityPageCounts = await getEntityPageCounts(totalWorks);
  const totalSitePages = sitemapEntries.length;

  if (!config.configured) {
    logSeoGscConnectionResult({
      success: false,
      error: config.configMessage ?? "認証情報が未設定です",
    });

    const payload: SeoCachePayload = {
      ...base,
      configured: false,
      connectionStatus: "unconfigured",
      configMessage: config.configMessage,
      overview: {
        ...base.overview,
        totalWorks,
      },
      index: {
        ...base.index,
        totalSitePages,
      },
      entityPageCounts,
      sitemapStatus: createEmptySitemapStatusSnapshot(siteUrl, entityPageCounts, totalWorks),
      entityWorkCounts,
    };

    await saveSeoCache(payload);
    return payload;
  }

  const resolvedSiteUrl = getSearchConsoleSiteUrl();

  try {
    console.info("[seo-gsc] starting Search Console refresh", {
      siteUrl: resolvedSiteUrl,
      serviceAccountEmail: getServiceAccountEmail(),
    });

    await getGoogleAccessToken();

    const connectionProbe = await probeSearchConsoleConnection(resolvedSiteUrl);
    if (connectionProbe.error) {
      const methodHint =
        connectionProbe.sitesListOk && !connectionProbe.searchAnalyticsOk
          ? `sites.list は成功しましたが、${connectionProbe.error.apiMethod} で失敗しました。`
          : `${connectionProbe.error.apiMethod} で失敗しました。`;

      throw new GoogleSearchConsoleError(
        connectionProbe.error.status === 403
          ? "permission_denied"
          : connectionProbe.error.status === 404
            ? "site_not_found"
            : connectionProbe.error.status === 429
              ? "quota_exceeded"
              : connectionProbe.error.status === 401
                ? "auth_failed"
                : "unknown",
        `${methodHint}\n${connectionProbe.error.message}`,
        connectionProbe.error.status,
        { apiMethod: connectionProbe.error.apiMethod },
      );
    }

    const [daily180Rows, sitemapApiRows] = await Promise.all([
      fetchDailySearchAnalytics(resolvedSiteUrl, 180),
      fetchSitemaps(resolvedSiteUrl),
    ]);

    const dailyStats = mapDailyRows(daily180Rows).slice(-90);

    const periodsEntries = await Promise.all(
      PERIOD_OPTIONS.map(async (days) => {
        const bundle = await fetchPeriodBundlePart(
          resolvedSiteUrl,
          days,
          mapDailyRows(daily180Rows),
        );
        return [days, bundle] as const;
      }),
    );

    const periods = Object.fromEntries(periodsEntries) as Record<
      SeoPeriodDays,
      SeoPeriodBundle
    >;

    const bundle28 = periods[28];
    const sitemaps = mapSitemapRows(sitemapApiRows);
    const crawlErrors = buildCrawlErrorGroups(sitemaps);
    const fetchedAt = new Date().toISOString();
    const sitemapStatus = buildEntitySitemapStatuses({
      siteUrl: resolvedSiteUrl,
      gscRows: sitemaps,
      entityPageCounts,
      worksCount: entityPageCounts.works,
      fetchedAt,
    });

    const indexedFromSitemap = sitemaps.reduce(
      (sum, row) => sum + row.indexedCount,
      0,
    );
    const indexedFromSearchImpressions = new Set(
      bundle28.pages
        .filter((page) => page.impressions > 0)
        .map((page) => page.url),
    ).size;

    const indexCounts = resolveIndexCounts({
      indexedFromSitemap,
      indexedFromSearchImpressions,
      totalSitePages,
    });

    const excludedPages = crawlErrors.reduce((sum, group) => sum + group.count, 0);
    const indexHistory = buildIndexHistory(
      dailyStats,
      indexCounts.indexedPages,
      indexCounts.notIndexedPages,
      excludedPages,
    );

    const newWorks = buildNewWorksSummary(
      catalogWorks,
      resolvedSiteUrl,
      bundle28.pages,
    );

    const overview = {
      totalWorks,
      indexedPages: indexCounts.indexedPages,
      notIndexedPages: indexCounts.notIndexedPages,
      clicks28d: bundle28.current.clicks,
      impressions28d: bundle28.current.impressions,
      ctr28d: bundle28.current.ctr,
      position28d: bundle28.current.position,
    };

    const payload: SeoCachePayload = {
      version: 2,
      source: "google_search_console",
      siteUrl: resolvedSiteUrl,
      updatedAt: new Date().toISOString(),
      configured: true,
      connectionStatus: "connected",
      stale: false,
      fetchError: undefined,
      configMessage: undefined,
      overview,
      periods,
      dailyStats: dailyStats.map((stat) => ({
        ...stat,
        indexedPages: indexCounts.indexedPages ?? undefined,
      })),
      queries: bundle28.queries,
      pages: bundle28.pages,
      index: {
        indexedPages: indexCounts.indexedPages,
        notIndexedPages: indexCounts.notIndexedPages,
        excludedPages,
        totalSitePages,
        registrationRate: indexCounts.registrationRate,
        indexedSource: indexCounts.indexedSource,
        history: indexHistory,
      },
      sitemaps,
      sitemapStatus,
      entityPageCounts,
      crawlErrors,
      newWorks,
      entityWorkCounts,
    };

    logSeoGscConnectionResult({
      success: true,
      siteUrl: resolvedSiteUrl,
      summary: {
        clicks28d: overview.clicks28d,
        impressions28d: overview.impressions28d,
        queries: bundle28.queries.length,
        pages: bundle28.pages.length,
        sitemaps: sitemaps.length,
      },
    });

    await saveSeoCache(payload);
    return payload;
  } catch (error) {
    const message =
      error instanceof GoogleSearchConsoleError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Search Console API 接続に失敗しました";
    logSeoGscConnectionResult({
      success: false,
      error: message,
      siteUrl: resolvedSiteUrl,
    });

    const previous = await loadSeoCache();
    if (previous.updatedAt) {
      const stale: SeoCachePayload = {
        ...previous,
        connectionStatus: "error",
        stale: true,
        fetchError: message,
        configMessage: `${previous.updatedAt}時点のキャッシュを表示しています`,
      };
      await saveSeoCache(stale);
      return stale;
    }

    const empty: SeoCachePayload = {
      ...createEmptySeoCache(resolvedSiteUrl),
      configured: true,
      connectionStatus: "error",
      fetchError: message,
      configMessage: message,
      overview: {
        ...createEmptySeoCache(resolvedSiteUrl).overview,
        totalWorks,
      },
      index: {
        ...createEmptySeoCache(resolvedSiteUrl).index,
        totalSitePages,
      },
      entityPageCounts,
      entityWorkCounts,
    };
    await saveSeoCache(empty);
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
