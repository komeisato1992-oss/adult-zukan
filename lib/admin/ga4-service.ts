import "server-only";

import { BetaAnalyticsDataClient, protos } from "@google-analytics/data";
import {
  detectRuntimeEnvironment,
  getServiceAccountCredentialsFromEnv,
  getServiceAccountJsonSource,
  getServiceAccountPublicInfo,
} from "@/lib/admin/seo-env";
import { getGa4PropertyIdFromEnv } from "@/lib/admin/google-env-status";
import {
  loadGa4CachePersisted,
  saveGa4CachePersisted,
} from "@/lib/admin/ga4-cache-store";
import {
  createEmptyGa4Cache,
  emptyGa4Metrics,
  type Ga4AuthDiagnostics,
  type Ga4CachePayload,
  type Ga4DailyPoint,
  type Ga4MetricSnapshot,
  type Ga4PageRow,
  type Ga4PeriodDays,
  type Ga4SourceRow,
} from "@/lib/admin/ga4-types";

const MetricAggregation =
  protos.google.analytics.data.v1beta.MetricAggregation;

type IRunReportRequest =
  protos.google.analytics.data.v1beta.IRunReportRequest;

/** GA4プロパティアクセス管理に登録済み想定のサービスアカウント */
export const EXPECTED_GA4_CLIENT_EMAIL =
  "adult-zukan-search-console@adult-zukan-seo-502016.iam.gserviceaccount.com";

export type {
  Ga4AuthDiagnostics,
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
    dimensionValues?: Array<{ value?: string | null } | null> | null;
    metricValues?: Array<{ value?: string | null } | null> | null;
  } | null> | null;
  totals?: Array<{
    metricValues?: Array<{ value?: string | null } | null> | null;
  } | null> | null;
};

function getGa4PropertyIdRaw(): string | null {
  return getGa4PropertyIdFromEnv();
}

function getGa4PropertyId(): string | null {
  const raw = getGa4PropertyIdRaw();
  if (!raw) return null;
  return raw.replace(/^properties\//i, "").trim() || null;
}

/** OK: properties/544245702 */
export function toGa4PropertyResource(raw: string): string {
  const id = raw.trim().replace(/^properties\//i, "");
  return `properties/${id}`;
}

export function isGa4Configured(): boolean {
  return Boolean(getServiceAccountCredentialsFromEnv() && getGa4PropertyId());
}

function buildAuthDiagnostics(errorCode: string | null = null): Ga4AuthDiagnostics {
  const publicInfo = getServiceAccountPublicInfo();
  const propertyId = getGa4PropertyId();
  return {
    clientEmail: publicInfo.clientEmail,
    projectId: publicInfo.projectId,
    propertyId,
    property: propertyId ? toGa4PropertyResource(propertyId) : null,
    credentialSource: publicInfo.source,
    sharedWithSearchConsole: true,
    runtimeEnvironment: detectRuntimeEnvironment(),
    expectedClientEmail: EXPECTED_GA4_CLIENT_EMAIL,
    clientEmailMatchesExpected: publicInfo.clientEmail
      ? publicInfo.clientEmail === EXPECTED_GA4_CLIENT_EMAIL
      : null,
    errorCode,
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

function num(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createGa4Client(): {
  client: BetaAnalyticsDataClient;
  clientEmail: string;
  projectId: string | null;
} {
  const credentials = getServiceAccountCredentialsFromEnv();
  if (!credentials) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON が未設定です（Search Console と同じ getServiceAccountCredentialsFromEnv を使用）。",
    );
  }

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id ?? undefined,
  });

  return {
    client,
    clientEmail: credentials.client_email,
    projectId: credentials.project_id,
  };
}

function extractGa4ErrorCode(error: unknown): string {
  const anyError = error as {
    code?: unknown;
    status?: unknown;
    message?: string;
  };
  if (typeof anyError?.code === "number" || typeof anyError?.code === "string") {
    const code = String(anyError.code);
    if (code === "7") return "PERMISSION_DENIED (7)";
    return code;
  }
  if (typeof anyError?.status === "number" || typeof anyError?.status === "string") {
    return String(anyError.status);
  }
  const message = anyError?.message ?? String(error);
  if (/PERMISSION_DENIED/i.test(message)) return "PERMISSION_DENIED";
  if (/403/.test(message)) return "403";
  return "UNKNOWN";
}

function serializeGa4ApiError(error: unknown): string {
  if (!(error instanceof Error)) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  const anyError = error as Error & {
    code?: unknown;
    details?: unknown;
    statusDetails?: unknown;
    errors?: unknown;
    note?: unknown;
  };

  const payload = {
    name: anyError.name,
    message: anyError.message,
    code: anyError.code,
    details: anyError.details,
    statusDetails: anyError.statusDetails,
    errors: anyError.errors,
    note: anyError.note,
  };

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return `${anyError.name}: ${anyError.message}`;
  }
}

async function runGa4Report(input: {
  client: BetaAnalyticsDataClient;
  clientEmail: string;
  projectId: string | null;
  propertyResource: string;
  propertyIdEnv: string;
  body: Omit<IRunReportRequest, "property">;
}): Promise<Ga4RunReportResponse> {
  const request: IRunReportRequest = {
    property: input.propertyResource,
    ...input.body,
  };

  console.log("[ga4] runReport request", {
    client_email: input.clientEmail,
    project_id: input.projectId,
    property: request.property,
    GA4_PROPERTY_ID: input.propertyIdEnv,
    runtime: detectRuntimeEnvironment(),
    metrics: input.body.metrics?.map((metric) => metric.name),
    dimensions: input.body.dimensions?.map((dimension) => dimension.name),
    dateRanges: input.body.dateRanges,
  });

  try {
    const [response] = await input.client.runReport(request);
    return response as Ga4RunReportResponse;
  } catch (error) {
    const code = extractGa4ErrorCode(error);
    const full = serializeGa4ApiError(error);
    console.error("[ga4] API error", {
      errorCode: code,
      client_email: input.clientEmail,
      project_id: input.projectId,
      property: input.propertyResource,
      GA4_PROPERTY_ID: input.propertyIdEnv,
      runtime: detectRuntimeEnvironment(),
      response: full,
    });
    throw Object.assign(
      new Error(
        code.includes("PERMISSION") || code.includes("403")
          ? `403 PERMISSION_DENIED: ${full}`
          : `GA4 API error (${code}): ${full}`,
      ),
      { ga4ErrorCode: code },
    );
  }
}

function metricsFromValues(
  values: Array<{ value?: string | null } | null | undefined>,
): Ga4MetricSnapshot {
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
  client: BetaAnalyticsDataClient,
  clientEmail: string,
  projectId: string | null,
  propertyResource: string,
  propertyIdEnv: string,
  startDate: string,
  endDate: string,
): Promise<Ga4MetricSnapshot> {
  const report = await runGa4Report({
    client,
    clientEmail,
    projectId,
    propertyResource,
    propertyIdEnv,
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
      metricAggregations: [MetricAggregation.TOTAL],
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
    authDiagnostics: buildAuthDiagnostics(
      payload.authDiagnostics?.errorCode ?? null,
    ),
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
      authDiagnostics: buildAuthDiagnostics(null),
      fetchError: cached.fetchError,
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
    const payload = {
      ...empty,
      lastSuccessfulAt: previous.lastSuccessfulAt,
      periods: previous.lastSuccessfulAt ? previous.periods : empty.periods,
      daily: previous.lastSuccessfulAt ? previous.daily : [],
      topPages: previous.lastSuccessfulAt ? previous.topPages : [],
      sources: previous.lastSuccessfulAt ? previous.sources : [],
      authDiagnostics: buildAuthDiagnostics(null),
    };
    await saveGa4CachePersisted(payload);
    return getGa4DashboardData();
  }

  const propertyId = getGa4PropertyId()!;
  const propertyResource = toGa4PropertyResource(propertyId);
  const publicInfo = getServiceAccountPublicInfo();

  console.info("[ga4] credential check (no secrets)", {
    client_email: publicInfo.clientEmail,
    project_id: publicInfo.projectId,
    property: propertyResource,
    GA4_PROPERTY_ID: propertyId,
    runtime: detectRuntimeEnvironment(),
    credentialSource: getServiceAccountJsonSource(),
    sharedLoader: publicInfo.sharedCredentialLoader,
    expectedClientEmail: EXPECTED_GA4_CLIENT_EMAIL,
    clientEmailMatchesExpected:
      publicInfo.clientEmail === EXPECTED_GA4_CLIENT_EMAIL,
  });

  try {
    const { client, clientEmail, projectId } = createGa4Client();
    const end = new Date();
    const periodDefs: Ga4PeriodDays[] = [1, 7, 28, 90];
    const periods = {} as Ga4CachePayload["periods"];

    for (const days of periodDefs) {
      const currentStart = formatDate(subtractDays(end, days - 1));
      const currentEnd = formatDate(end);
      const previousEnd = formatDate(subtractDays(end, days));
      const previousStart = formatDate(subtractDays(end, days * 2 - 1));
      const [current, previousMetrics] = await Promise.all([
        fetchPeriodMetrics(
          client,
          clientEmail,
          projectId,
          propertyResource,
          propertyId,
          currentStart,
          currentEnd,
        ),
        fetchPeriodMetrics(
          client,
          clientEmail,
          projectId,
          propertyResource,
          propertyId,
          previousStart,
          previousEnd,
        ),
      ]);
      periods[days] = { current, previous: previousMetrics };
    }

    const dailyReport = await runGa4Report({
      client,
      clientEmail,
      projectId,
      propertyResource,
      propertyIdEnv: propertyId,
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

    const daily: Ga4DailyPoint[] = (dailyReport.rows ?? [])
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => {
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
      client,
      clientEmail,
      projectId,
      propertyResource,
      propertyIdEnv: propertyId,
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

    const topPages: Ga4PageRow[] = (pagesReport.rows ?? [])
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => {
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
      client,
      clientEmail,
      projectId,
      propertyResource,
      propertyIdEnv: propertyId,
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

    const sources: Ga4SourceRow[] = (sourceReport.rows ?? [])
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        source: row.dimensionValues?.[0]?.value ?? "Other",
        sessions: num(row.metricValues?.[0]?.value),
        users: num(row.metricValues?.[1]?.value),
      }));

    const now = new Date().toISOString();
    const payload: Ga4CachePayload = {
      version: 3,
      updatedAt: now,
      lastSuccessfulAt: now,
      configured: true,
      propertyId,
      connectionStatus: "connected",
      authDiagnostics: buildAuthDiagnostics(null),
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
    const errorCode =
      (error as { ga4ErrorCode?: string })?.ga4ErrorCode ??
      extractGa4ErrorCode(error);
    console.error("[ga4] refresh failed", {
      errorCode,
      client_email: publicInfo.clientEmail,
      project_id: publicInfo.projectId,
      property: propertyResource,
      GA4_PROPERTY_ID: propertyId,
      runtime: detectRuntimeEnvironment(),
      message: message.slice(0, 2000),
    });
    const stale: Ga4CachePayload = {
      ...previous,
      version: 3,
      configured: true,
      propertyId,
      connectionStatus: previous.lastSuccessfulAt ? "stale" : "error",
      fetchError: message,
      updatedAt: previous.updatedAt,
      lastSuccessfulAt: previous.lastSuccessfulAt,
      authDiagnostics: buildAuthDiagnostics(errorCode),
      configMessage: previous.lastSuccessfulAt
        ? `${previous.lastSuccessfulAt}時点のキャッシュを表示しています`
        : message,
    };
    await saveGa4CachePersisted(stale);
    return stale;
  }
}
