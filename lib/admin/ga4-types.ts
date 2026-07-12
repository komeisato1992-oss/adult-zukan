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

export type Ga4AuthDiagnostics = {
  clientEmail: string | null;
  projectId: string | null;
  propertyId: string | null;
  property: string | null;
  credentialSource: string | null;
  sharedWithSearchConsole: boolean;
  runtimeEnvironment: "production" | "preview" | "development";
  expectedClientEmail: string;
  clientEmailMatchesExpected: boolean | null;
  errorCode: string | null;
};

export type Ga4CachePayload = {
  version: 3;
  updatedAt: string | null;
  /** 直近の正常取得日時（障害時も保持） */
  lastSuccessfulAt: string | null;
  configured: boolean;
  configMessage?: string;
  propertyId: string | null;
  connectionStatus: "connected" | "error" | "unconfigured" | "stale";
  fetchError?: string;
  authDiagnostics?: Ga4AuthDiagnostics;
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

export function emptyGa4Metrics(): Ga4MetricSnapshot {
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

export function createEmptyGa4Cache(options?: {
  configured?: boolean;
  propertyId?: string | null;
  message?: string;
}): Ga4CachePayload {
  const configured = options?.configured ?? false;
  const propertyId = options?.propertyId ?? null;
  return {
    version: 3,
    updatedAt: null,
    lastSuccessfulAt: null,
    configured,
    configMessage:
      options?.message ??
      (configured
        ? "GA4データをまだ取得していません。更新ボタンまたはCronで取得してください。"
        : "GA4_PROPERTY_ID を設定し、サービスアカウントに Analytics 閲覧権限を付与してください。"),
    propertyId,
    connectionStatus: configured ? "error" : "unconfigured",
    authDiagnostics: undefined,
    periods: {
      1: { current: emptyGa4Metrics(), previous: emptyGa4Metrics() },
      7: { current: emptyGa4Metrics(), previous: emptyGa4Metrics() },
      28: { current: emptyGa4Metrics(), previous: emptyGa4Metrics() },
      90: { current: emptyGa4Metrics(), previous: emptyGa4Metrics() },
    },
    daily: [],
    topPages: [],
    sources: [],
  };
}
