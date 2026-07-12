import "server-only";

import {
  getGoogleAccessTokenForScopes,
  GOOGLE_SCOPE_ANALYTICS,
} from "@/lib/admin/google-access-token";
import { getServiceAccountCredentialsFromEnv } from "@/lib/admin/seo-env";
import {
  loadGa4CachePersisted,
  saveGa4CachePersisted,
} from "@/lib/admin/ga4-cache-store";
import {
  createEmptyGa4Cache,
  emptyGa4Metrics,
  type Ga4CachePayload,
  type Ga4DailyPoint,
  type Ga4MetricSnapshot,
  type Ga4PageRow,
  type Ga4PeriodDays,
  type Ga4SourceRow,
} from "@/lib/admin/ga4-types";

export type {
  Ga4CachePayload,
  Ga4DailyPoint,
  Ga4MetricSnapshot,
  Ga4PageRow,
  Ga4PeriodDays,
  Ga4SourceRow,
} from "@/lib/admin/ga4-types";

export { createEmptyGa4Cache } from "@/lib/admin/ga4-types";

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
    throw new Error(`GA4 API error ${response.status}: ${text.slice(0, 400)}`);
  }

  return (await response.json()) as Ga4RunReportResponse;
}

function metricsFromValues(values: Array<{ value?: string } | undefined>): Ga4MetricSnapshot {
  const users = num(values[0]?.value);
  const newUsers = num(values[1]?.value);
  const sessions = num(values[2]?.value);
  const pageViews = num(values[3]?.value);
  const engagementTotal = num(values[4]?.value);
  const eventCount = num(values[5]?.value);
  const bounceRate = num(values[6]?.value);
  return {
    users,
    newUsers,
    sessions,
    pageViews,
    avgEngagementSeconds: users > 0 ? engagementTotal / users : 0,
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
        { name: "userEngagementDuration" },
        { name: "eventCount" },
        { name: "bounceRate" },
      ],
      metricAggregations: ["TOTAL"],
    },
  });

  const values =
    report.totals?.[0]?.metricValues ?? report.rows?.[0]?.metricValues;
  if (!values) return emptyGa4Metrics();
  return metricsFromValues(values);
}

function withConfigFlags(payload: Ga4CachePayload): Ga4CachePayload {
  const configured = isGa4Configured();
  return {
    ...payload,
    configured,
    propertyId: getGa4PropertyId(),
    configMessage: configured
      ? payload.configMessage
      : "GA4_PROPERTY_ID を設定し、サービスアカウントに Analytics 閲覧権限を付与してください。",
    connectionStatus: configured
      ? payload.connectionStatus === "unconfigured"
        ? payload.lastSuccessfulAt
          ? "stale"
          : "error"
        : payload.connectionStatus
      : "unconfigured",
  };
}

/** キャッシュ優先。更新ボタン/Cron以外では API を叩かない */
export async function getGa4DashboardData(): Promise<Ga4CachePayload> {
  const cached = withConfigFlags(await loadGa4CachePersisted());
  if (!isGa4Configured()) {
    return {
      ...createEmptyGa4Cache({
        configured: false,
        propertyId: null,
      }),
      lastSuccessfulAt: cached.lastSuccessfulAt,
      periods: cached.lastSuccessfulAt ? cached.periods : createEmptyGa4Cache().periods,
      daily: cached.lastSuccessfulAt ? cached.daily : [],
      topPages: cached.lastSuccessfulAt ? cached.topPages : [],
      sources: cached.lastSuccessfulAt ? cached.sources : [],
      updatedAt: cached.updatedAt,
    };
  }
  return cached;
}

export async function refreshGa4DashboardData(): Promise<Ga4CachePayload> {
  const previous = await loadGa4CachePersisted();

  if (!isGa4Configured()) {
    const empty = createEmptyGa4Cache({
      configured: false,
      propertyId: getGa4PropertyId(),
    });
    await saveGa4CachePersisted({
      ...empty,
      lastSuccessfulAt: previous.lastSuccessfulAt,
      periods: previous.lastSuccessfulAt ? previous.periods : empty.periods,
      daily: previous.lastSuccessfulAt ? previous.daily : [],
      topPages: previous.lastSuccessfulAt ? previous.topPages : [],
      sources: previous.lastSuccessfulAt ? previous.sources : [],
    });
    return getGa4DashboardData();
  }

  const propertyId = getGa4PropertyId()!;

  try {
    const token = await getGoogleAccessTokenForScopes([GOOGLE_SCOPE_ANALYTICS]);
    const end = new Date();
    const periodDefs: Ga4PeriodDays[] = [1, 7, 28, 90];
    const periods = {} as Ga4CachePayload["periods"];

    for (const days of periodDefs) {
      const currentStart = formatDate(subtractDays(end, days - 1));
      const currentEnd = formatDate(end);
      const previousEnd = formatDate(subtractDays(end, days));
      const previousStart = formatDate(subtractDays(end, days * 2 - 1));
      const [current, previousMetrics] = await Promise.all([
        fetchPeriodMetrics(propertyId, token, currentStart, currentEnd),
        fetchPeriodMetrics(propertyId, token, previousStart, previousEnd),
      ]);
      periods[days] = { current, previous: previousMetrics };
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
          { name: "userEngagementDuration" },
        ],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 20,
      },
    });

    const topPages: Ga4PageRow[] = (pagesReport.rows ?? []).map((row) => {
      const users = num(row.metricValues?.[1]?.value);
      const engagement = num(row.metricValues?.[2]?.value);
      return {
        path: row.dimensionValues?.[0]?.value ?? "/",
        pageViews: num(row.metricValues?.[0]?.value),
        users,
        avgEngagementSeconds: users > 0 ? engagement / users : 0,
      };
    });

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

    const now = new Date().toISOString();
    const payload: Ga4CachePayload = {
      version: 2,
      updatedAt: now,
      lastSuccessfulAt: now,
      configured: true,
      propertyId,
      connectionStatus: "connected",
      periods,
      daily,
      topPages,
      sources,
    };

    await saveGa4CachePersisted(payload);
    return payload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GA4取得に失敗しました。";
    const stale: Ga4CachePayload = {
      ...previous,
      version: 2,
      configured: true,
      propertyId,
      connectionStatus: previous.lastSuccessfulAt ? "stale" : "error",
      fetchError: message,
      updatedAt: previous.updatedAt,
      lastSuccessfulAt: previous.lastSuccessfulAt,
      configMessage: previous.lastSuccessfulAt
        ? `前回取得日時: ${previous.lastSuccessfulAt}`
        : message,
    };
    await saveGa4CachePersisted(stale);
    return stale;
  }
}
