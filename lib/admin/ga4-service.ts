import "server-only";

import {
  getGoogleAccessTokenForScopes,
  GOOGLE_SCOPE_ANALYTICS,
} from "@/lib/admin/google-access-token";
import { getServiceAccountCredentialsFromEnv } from "@/lib/admin/seo-env";

export type Ga4PeriodDays = 1 | 7 | 28 | 90;

export type Ga4MetricSnapshot = {
  users: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgEngagementSeconds: number;
  eventCount: number;
  bounceRate: number;
  pagesPerSession: number;
};

export type Ga4DailyPoint = {
  date: string;
  users: number;
  newUsers: number;
  pageViews: number;
  sessions: number;
};

export type Ga4PageRow = {
  path: string;
  pageViews: number;
  users: number;
  avgEngagementSeconds: number;
};

export type Ga4SourceRow = {
  source: string;
  sessions: number;
  users: number;
};

export type Ga4CachePayload = {
  version: 1;
  updatedAt: string | null;
  configured: boolean;
  configMessage?: string;
  propertyId: string | null;
  connectionStatus: "connected" | "error" | "unconfigured";
  fetchError?: string;
  periods: Record<
    Ga4PeriodDays,
    {
      current: Ga4MetricSnapshot;
      previous: Ga4MetricSnapshot;
    }
  >;
  daily: Ga4DailyPoint[];
  topPages: Ga4PageRow[];
  sources: Ga4SourceRow[];
};

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  totals?: Array<{
    metricValues?: Array<{ value?: string }>;
  }>;
};

function getGa4PropertyId(): string | null {
  return (
    process.env.GA4_PROPERTY_ID?.trim() ||
    process.env.GOOGLE_ANALYTICS_PROPERTY_ID?.trim() ||
    null
  );
}

export function isGa4Configured(): boolean {
  return Boolean(getServiceAccountCredentialsFromEnv() && getGa4PropertyId());
}

function emptyMetrics(): Ga4MetricSnapshot {
  return {
    users: 0,
    newUsers: 0,
    sessions: 0,
    pageViews: 0,
    avgEngagementSeconds: 0,
    eventCount: 0,
    bounceRate: 0,
    pagesPerSession: 0,
  };
}

export function createEmptyGa4Cache(message?: string): Ga4CachePayload {
  return {
    version: 1,
    updatedAt: null,
    configured: isGa4Configured(),
    configMessage:
      message ??
      "GA4_PROPERTY_ID とサービスアカウント（Analytics閲覧権限）を設定してください。",
    propertyId: getGa4PropertyId(),
    connectionStatus: isGa4Configured() ? "error" : "unconfigured",
    periods: {
      1: { current: emptyMetrics(), previous: emptyMetrics() },
      7: { current: emptyMetrics(), previous: emptyMetrics() },
      28: { current: emptyMetrics(), previous: emptyMetrics() },
      90: { current: emptyMetrics(), previous: emptyMetrics() },
    },
    daily: [],
    topPages: [],
    sources: [],
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function num(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runGa4Report(input: {
  propertyId: string;
  token: string;
  body: Record<string, unknown>;
}): Promise<Ga4RunReportResponse> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA4 API error ${response.status}: ${text.slice(0, 500)}`);
  }

  return (await response.json()) as Ga4RunReportResponse;
}

function metricsFromTotals(totals?: Ga4RunReportResponse["totals"]): Ga4MetricSnapshot {
  const values = totals?.[0]?.metricValues ?? [];
  const users = num(values[0]?.value);
  const newUsers = num(values[1]?.value);
  const sessions = num(values[2]?.value);
  const pageViews = num(values[3]?.value);
  const avgEngagementSeconds = num(values[4]?.value);
  const eventCount = num(values[5]?.value);
  const bounceRate = num(values[6]?.value);
  return {
    users,
    newUsers,
    sessions,
    pageViews,
    avgEngagementSeconds,
    eventCount,
    bounceRate,
    pagesPerSession: sessions > 0 ? pageViews / sessions : 0,
  };
}

async function fetchPeriodMetrics(
  propertyId: string,
  token: string,
  startDate: string,
  endDate: string,
): Promise<Ga4MetricSnapshot> {
  const report = await runGa4Report({
    propertyId,
    token,
    body: {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "eventCount" },
        { name: "bounceRate" },
      ],
      metricAggregations: ["TOTAL"],
    },
  });

  if (report.totals?.[0]?.metricValues) {
    return metricsFromTotals(report.totals);
  }

  if (report.rows?.[0]?.metricValues) {
    return metricsFromTotals([
      { metricValues: report.rows[0].metricValues },
    ]);
  }

  return emptyMetrics();
}

let memoryCache: Ga4CachePayload | null = null;

export function loadGa4Cache(): Ga4CachePayload {
  return memoryCache ?? createEmptyGa4Cache();
}

export function saveGa4Cache(payload: Ga4CachePayload): void {
  memoryCache = payload;
}

export async function refreshGa4DashboardData(): Promise<Ga4CachePayload> {
  if (!isGa4Configured()) {
    const empty = createEmptyGa4Cache();
    saveGa4Cache(empty);
    return empty;
  }

  const propertyId = getGa4PropertyId()!;
  const token = await getGoogleAccessTokenForScopes([GOOGLE_SCOPE_ANALYTICS]);
  const end = new Date();

  const periodDefs: Ga4PeriodDays[] = [1, 7, 28, 90];
  const periods = {} as Ga4CachePayload["periods"];

  for (const days of periodDefs) {
    const currentStart = formatDate(subtractDays(end, days - 1));
    const currentEnd = formatDate(end);
    const previousEnd = formatDate(subtractDays(end, days));
    const previousStart = formatDate(subtractDays(end, days * 2 - 1));

    const [current, previous] = await Promise.all([
      fetchPeriodMetrics(propertyId, token, currentStart, currentEnd),
      fetchPeriodMetrics(propertyId, token, previousStart, previousEnd),
    ]);
    periods[days] = { current, previous };
  }

  const dailyReport = await runGa4Report({
    propertyId,
    token,
    body: {
      dateRanges: [
        {
          startDate: formatDate(subtractDays(end, 89)),
          endDate: formatDate(end),
        },
      ],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
        { name: "sessions" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    },
  });

  const daily: Ga4DailyPoint[] = (dailyReport.rows ?? []).map((row) => {
    const rawDate = row.dimensionValues?.[0]?.value ?? "";
    const date =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    return {
      date,
      users: num(row.metricValues?.[0]?.value),
      newUsers: num(row.metricValues?.[1]?.value),
      pageViews: num(row.metricValues?.[2]?.value),
      sessions: num(row.metricValues?.[3]?.value),
    };
  });

  const pagesReport = await runGa4Report({
    propertyId,
    token,
    body: {
      dateRanges: [
        {
          startDate: formatDate(subtractDays(end, 27)),
          endDate: formatDate(end),
        },
      ],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    },
  });

  const topPages: Ga4PageRow[] = (pagesReport.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "/",
    pageViews: num(row.metricValues?.[0]?.value),
    users: num(row.metricValues?.[1]?.value),
    avgEngagementSeconds: num(row.metricValues?.[2]?.value),
  }));

  const sourceReport = await runGa4Report({
    propertyId,
    token,
    body: {
      dateRanges: [
        {
          startDate: formatDate(subtractDays(end, 27)),
          endDate: formatDate(end),
        },
      ],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    },
  });

  const sources: Ga4SourceRow[] = (sourceReport.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "Other",
    sessions: num(row.metricValues?.[0]?.value),
    users: num(row.metricValues?.[1]?.value),
  }));

  const payload: Ga4CachePayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    configured: true,
    propertyId,
    connectionStatus: "connected",
    periods,
    daily,
    topPages,
    sources,
  };

  saveGa4Cache(payload);
  return payload;
}

export async function getGa4DashboardData(): Promise<Ga4CachePayload> {
  const cached = loadGa4Cache();
  if (cached.updatedAt) return cached;
  if (!isGa4Configured()) return cached;
  try {
    return await refreshGa4DashboardData();
  } catch (error) {
    return {
      ...createEmptyGa4Cache(
        error instanceof Error ? error.message : "GA4取得に失敗しました。",
      ),
      connectionStatus: "error",
      fetchError:
        error instanceof Error ? error.message : "GA4取得に失敗しました。",
    };
  }
}
