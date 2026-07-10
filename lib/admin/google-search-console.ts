import "server-only";

import { readGscSiteUrlFromEnv } from "@/lib/admin/seo-config";
import {
  classifySearchConsoleApiError,
  GoogleSearchConsoleError,
} from "@/lib/admin/google-search-console-errors";
import { getGoogleAccessToken } from "@/lib/admin/google-service-account";

const SEARCH_CONSOLE_BASE =
  "https://www.googleapis.com/webmasters/v3/sites";

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
};

type SitemapEntry = {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  contents?: Array<{
    type?: string;
    submitted?: string;
    indexed?: string;
  }>;
  errors?: string;
  warnings?: string;
};

type SitemapsListResponse = {
  sitemap?: SitemapEntry[];
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export function getSearchConsoleSiteUrl(): string {
  const configured = readGscSiteUrlFromEnv();
  if (!configured) {
    throw new GoogleSearchConsoleError(
      "missing_gsc_site_url",
      "GSC_SITE_URL が未設定です。`.env.local` に Search Console プロパティ URL（例: https://adult-zukan.jp/）を設定してください。",
      400,
    );
  }
  return configured;
}

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

async function searchConsoleFetch<T>(
  path: string,
  init?: RequestInit,
  siteUrl?: string,
): Promise<T> {
  const token = await getGoogleAccessToken();
  const response = await fetch(`${SEARCH_CONSOLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw classifySearchConsoleApiError(response.status, text, siteUrl);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function fetchSearchAnalyticsRows(options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit?: number;
  startRow?: number;
}): Promise<SearchAnalyticsRow[]> {
  const site = encodeSiteUrl(options.siteUrl);
  const data = await searchConsoleFetch<SearchAnalyticsResponse>(
    `/${site}/searchAnalytics/query`,
    {
      method: "POST",
      body: JSON.stringify({
        startDate: options.startDate,
        endDate: options.endDate,
        dimensions: options.dimensions,
        rowLimit: options.rowLimit ?? 1000,
        startRow: options.startRow ?? 0,
      }),
    },
    options.siteUrl,
  );

  return data.rows ?? [];
}

export async function fetchDailySearchAnalytics(
  siteUrl: string,
  days: number,
): Promise<SearchAnalyticsRow[]> {
  const endDate = new Date();
  const startDate = subtractDays(endDate, days - 1);
  return fetchSearchAnalyticsRows({
    siteUrl,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ["date"],
    rowLimit: days,
  });
}

export async function fetchQuerySearchAnalytics(
  siteUrl: string,
  days: number,
): Promise<SearchAnalyticsRow[]> {
  const endDate = new Date();
  const startDate = subtractDays(endDate, days - 1);
  return fetchSearchAnalyticsRows({
    siteUrl,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ["query"],
    rowLimit: 2500,
  });
}

export async function fetchPageSearchAnalytics(
  siteUrl: string,
  days: number,
): Promise<SearchAnalyticsRow[]> {
  const endDate = new Date();
  const startDate = subtractDays(endDate, days - 1);
  return fetchSearchAnalyticsRows({
    siteUrl,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ["page"],
    rowLimit: 2500,
  });
}

export async function fetchSitemaps(siteUrl: string): Promise<SitemapEntry[]> {
  const site = encodeSiteUrl(siteUrl);
  const data = await searchConsoleFetch<SitemapsListResponse>(
    `/${site}/sitemaps`,
    undefined,
    siteUrl,
  );
  return data.sitemap ?? [];
}

export async function submitSitemap(
  siteUrl: string,
  sitemapPath: string,
): Promise<void> {
  const site = encodeSiteUrl(siteUrl);
  const feedpath = encodeURIComponent(sitemapPath);
  await searchConsoleFetch<Record<string, never>>(
    `/${site}/sitemaps/${feedpath}`,
    { method: "PUT" },
    siteUrl,
  );
}

export function aggregateAnalyticsRows(rows: SearchAnalyticsRow[]): {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
} {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;

  for (const row of rows) {
    const rowClicks = row.clicks ?? 0;
    const rowImpressions = row.impressions ?? 0;
    clicks += rowClicks;
    impressions += rowImpressions;
    weightedPosition += (row.position ?? 0) * rowImpressions;
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

export function mapDailyRows(rows: SearchAnalyticsRow[]) {
  return rows
    .map((row) => ({
      date: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
    .filter((row) => row.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mapQueryRows(rows: SearchAnalyticsRow[]) {
  return rows
    .map((row) => ({
      keyword: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
    .filter((row) => row.keyword.length > 0)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export function mapPageRows(rows: SearchAnalyticsRow[]) {
  return rows
    .map((row) => ({
      url: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
    .filter((row) => row.url.length > 0)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export function mapSitemapRows(entries: SitemapEntry[]) {
  return entries
    .map((entry) => {
      const contents = entry.contents ?? [];
      const contentsCount = contents.reduce(
        (sum, item) => sum + Number.parseInt(item.submitted ?? "0", 10),
        0,
      );
      const indexedCount = contents.reduce(
        (sum, item) => sum + Number.parseInt(item.indexed ?? "0", 10),
        0,
      );

      return {
        path: entry.path ?? "",
        lastSubmitted: entry.lastSubmitted,
        lastDownloaded: entry.lastDownloaded,
        contentsCount,
        indexedCount,
        errors: Number.parseInt(entry.errors ?? "0", 10),
        warnings: Number.parseInt(entry.warnings ?? "0", 10),
      };
    })
    .filter((row) => row.path.length > 0);
}

export function buildCrawlErrorGroups(
  sitemapRows: ReturnType<typeof mapSitemapRows>,
): Array<{
  type: "404" | "500" | "redirect" | "canonical" | "robots" | "noindex" | "duplicate";
  label: string;
  count: number;
  urls: string[];
}> {
  const errorCount = sitemapRows.reduce((sum, row) => sum + row.errors, 0);
  const warningCount = sitemapRows.reduce((sum, row) => sum + row.warnings, 0);

  return [
    {
      type: "404",
      label: "404",
      count: errorCount,
      urls: sitemapRows
        .filter((row) => row.errors > 0)
        .map((row) => row.path),
    },
    {
      type: "redirect",
      label: "Redirect",
      count: warningCount,
      urls: sitemapRows
        .filter((row) => row.warnings > 0)
        .map((row) => row.path),
    },
    {
      type: "canonical",
      label: "Canonical",
      count: 0,
      urls: [],
    },
    {
      type: "robots",
      label: "robots",
      count: 0,
      urls: [],
    },
    {
      type: "noindex",
      label: "noindex",
      count: 0,
      urls: [],
    },
    {
      type: "duplicate",
      label: "Duplicate",
      count: 0,
      urls: [],
    },
    {
      type: "500",
      label: "500",
      count: 0,
      urls: [],
    },
  ];
}
