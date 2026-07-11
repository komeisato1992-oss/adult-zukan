import "server-only";

import { readGscSiteUrlFromEnv } from "@/lib/admin/seo-config";
import {
  classifySearchConsoleApiError,
  GoogleSearchConsoleError,
  logGoogleApiError,
  parseGoogleApiErrorBody,
} from "@/lib/admin/google-search-console-errors";
import {
  getGoogleAccessToken,
  getServiceAccountEmail,
} from "@/lib/admin/google-service-account";

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

type SitesListResponse = {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
};

export type SearchConsoleConnectionProbe = {
  siteUrl: string;
  serviceAccountEmail: string | null;
  sitesListOk: boolean;
  sitesListCount: number;
  configuredSiteFound: boolean;
  configuredSitePermission?: string;
  availableSites: string[];
  searchAnalyticsOk: boolean;
  error?: {
    apiMethod: string;
    message: string;
    status: number;
    googleStatus?: string;
    errors: Array<{ message?: string; domain?: string; reason?: string }>;
  };
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

function logSearchConsoleRequest(apiMethod: string, siteUrl?: string): void {
  console.info("[seo-gsc] Search Console API request", {
    apiMethod,
    siteUrl: siteUrl ?? "(n/a)",
    serviceAccountEmail: getServiceAccountEmail(),
  });
}

async function searchConsoleFetch<T>(
  path: string,
  apiMethod: string,
  init?: RequestInit,
  siteUrl?: string,
): Promise<T> {
  logSearchConsoleRequest(apiMethod, siteUrl);

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
    const parsed = parseGoogleApiErrorBody(text, response.status);
    logGoogleApiError("Search Console API request failed", apiMethod, parsed, {
      siteUrl,
      serviceAccountEmail: getServiceAccountEmail(),
    });
    throw classifySearchConsoleApiError(response.status, text, {
      siteUrl,
      apiMethod,
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/** searchconsole.sites.list() 相当 */
export async function listSearchConsoleSites(): Promise<
  NonNullable<SitesListResponse["siteEntry"]>
> {
  const data = await searchConsoleFetch<SitesListResponse>(
    "",
    "sites.list",
  );
  return data.siteEntry ?? [];
}

function normalizeSiteUrlForCompare(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function findConfiguredSiteInList(
  siteUrl: string,
  sites: NonNullable<SitesListResponse["siteEntry"]>,
): { found: boolean; permissionLevel?: string } {
  const normalizedTarget = normalizeSiteUrlForCompare(siteUrl);
  const match = sites.find(
    (entry) =>
      entry.siteUrl &&
      normalizeSiteUrlForCompare(entry.siteUrl) === normalizedTarget,
  );

  return {
    found: Boolean(match),
    permissionLevel: match?.permissionLevel,
  };
}

/** sites.list → searchAnalytics.query の順で接続診断 */
export async function probeSearchConsoleConnection(
  siteUrl: string,
): Promise<SearchConsoleConnectionProbe> {
  const serviceAccountEmail = getServiceAccountEmail();
  console.info("[seo-gsc] probing Search Console connection", {
    siteUrl,
    serviceAccountEmail,
  });

  const probe: SearchConsoleConnectionProbe = {
    siteUrl,
    serviceAccountEmail,
    sitesListOk: false,
    sitesListCount: 0,
    configuredSiteFound: false,
    availableSites: [],
    searchAnalyticsOk: false,
  };

  try {
    const sites = await listSearchConsoleSites();
    probe.sitesListOk = true;
    probe.sitesListCount = sites.length;
    probe.availableSites = sites
      .map((entry) => entry.siteUrl)
      .filter((value): value is string => Boolean(value));

    const siteMatch = findConfiguredSiteInList(siteUrl, sites);
    probe.configuredSiteFound = siteMatch.found;
    probe.configuredSitePermission = siteMatch.permissionLevel;

    if (!siteMatch.found) {
      probe.error = {
        apiMethod: "sites.list",
        status: 404,
        message: `GSC_SITE_URL (${siteUrl}) が Search Console のプロパティ一覧に見つかりません。利用可能: ${probe.availableSites.join(", ") || "なし"}`,
        googleStatus: "NOT_FOUND",
        errors: [],
      };
      return probe;
    }
  } catch (error) {
    if (error instanceof GoogleSearchConsoleError) {
      probe.error = {
        apiMethod: error.apiMethod ?? "sites.list",
        status: error.status,
        message: error.message,
        googleStatus: error.googleError?.status,
        errors: error.googleError?.errors ?? [],
      };
    } else {
      probe.error = {
        apiMethod: "sites.list",
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        errors: [],
      };
    }
    return probe;
  }

  try {
    const endDate = new Date();
    const startDate = subtractDays(endDate, 2);
    await fetchSearchAnalyticsRows({
      siteUrl,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ["date"],
      rowLimit: 1,
    });
    probe.searchAnalyticsOk = true;
  } catch (error) {
    if (error instanceof GoogleSearchConsoleError) {
      probe.error = {
        apiMethod: error.apiMethod ?? "searchAnalytics.query",
        status: error.status,
        message: error.message,
        googleStatus: error.googleError?.status,
        errors: error.googleError?.errors ?? [],
      };
    } else {
      probe.error = {
        apiMethod: "searchAnalytics.query",
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        errors: [],
      };
    }
  }

  return probe;
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
    "searchAnalytics.query",
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

export async function fetchSearchAnalyticsForRange(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 2500,
): Promise<SearchAnalyticsRow[]> {
  return fetchSearchAnalyticsRows({
    siteUrl,
    startDate,
    endDate,
    dimensions,
    rowLimit,
  });
}

export async function fetchQuerySearchAnalytics(
  siteUrl: string,
  days: number,
): Promise<SearchAnalyticsRow[]> {
  const endDate = new Date();
  const startDate = subtractDays(endDate, days - 1);
  return fetchSearchAnalyticsForRange(
    siteUrl,
    formatDate(startDate),
    formatDate(endDate),
    ["query"],
    2500,
  );
}

export async function fetchPageSearchAnalytics(
  siteUrl: string,
  days: number,
): Promise<SearchAnalyticsRow[]> {
  const endDate = new Date();
  const startDate = subtractDays(endDate, days - 1);
  return fetchSearchAnalyticsForRange(
    siteUrl,
    formatDate(startDate),
    formatDate(endDate),
    ["page"],
    2500,
  );
}

export async function fetchSitemaps(siteUrl: string): Promise<SitemapEntry[]> {
  const site = encodeSiteUrl(siteUrl);
  const data = await searchConsoleFetch<SitemapsListResponse>(
    `/${site}/sitemaps`,
    "sitemaps.list",
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
    "sitemaps.submit",
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
