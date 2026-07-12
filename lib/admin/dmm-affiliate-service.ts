import "server-only";

export type DmmAffiliatePeriod = "today" | "yesterday" | "7d" | "28d";

export type DmmAffiliateMetrics = {
  clicks: number;
  conversions: number;
  conversionRate: number;
  reward: number;
  clickUnitPrice: number;
  conversionUnitPrice: number;
};

export type DmmAffiliateDailyPoint = {
  date: string;
  clicks: number;
  conversions: number;
  reward: number;
};

export type DmmAffiliateCachePayload = {
  version: 1;
  updatedAt: string | null;
  configured: boolean;
  configMessage?: string;
  connectionStatus: "connected" | "error" | "unconfigured";
  fetchError?: string;
  periods: Record<DmmAffiliatePeriod, DmmAffiliateMetrics>;
  daily: DmmAffiliateDailyPoint[];
};

function emptyMetrics(): DmmAffiliateMetrics {
  return {
    clicks: 0,
    conversions: 0,
    conversionRate: 0,
    reward: 0,
    clickUnitPrice: 0,
    conversionUnitPrice: 0,
  };
}

export function createEmptyDmmAffiliateCache(
  message?: string,
): DmmAffiliateCachePayload {
  const configured = Boolean(
    process.env.DMM_AFFILIATE_REPORT_URL?.trim() ||
      process.env.DMM_AFFILIATE_REPORT_JSON?.trim(),
  );

  return {
    version: 1,
    updatedAt: null,
    configured,
    configMessage:
      message ??
      "DMMアフィリエイト成果APIが未設定です。DMM_AFFILIATE_REPORT_URL または DMM_AFFILIATE_REPORT_JSON を設定してください。",
    connectionStatus: configured ? "error" : "unconfigured",
    periods: {
      today: emptyMetrics(),
      yesterday: emptyMetrics(),
      "7d": emptyMetrics(),
      "28d": emptyMetrics(),
    },
    daily: [],
  };
}

function withDerived(metrics: {
  clicks: number;
  conversions: number;
  reward: number;
}): DmmAffiliateMetrics {
  return {
    clicks: metrics.clicks,
    conversions: metrics.conversions,
    conversionRate:
      metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0,
    reward: metrics.reward,
    clickUnitPrice: metrics.clicks > 0 ? metrics.reward / metrics.clicks : 0,
    conversionUnitPrice:
      metrics.conversions > 0 ? metrics.reward / metrics.conversions : 0,
  };
}

function sumDaily(
  daily: DmmAffiliateDailyPoint[],
  startInclusive: string,
  endInclusive: string,
): DmmAffiliateMetrics {
  let clicks = 0;
  let conversions = 0;
  let reward = 0;
  for (const row of daily) {
    if (row.date < startInclusive || row.date > endInclusive) continue;
    clicks += row.clicks;
    conversions += row.conversions;
    reward += row.reward;
  }
  return withDerived({ clicks, conversions, reward });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

type ExternalReport = {
  daily?: Array<{
    date?: string;
    clicks?: number;
    conversions?: number;
    reward?: number;
  }>;
};

function parseExternalReport(raw: unknown): DmmAffiliateDailyPoint[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as ExternalReport;
  if (!Array.isArray(data.daily)) return [];
  return data.daily
    .map((row) => ({
      date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
      clicks: Number(row.clicks ?? 0) || 0,
      conversions: Number(row.conversions ?? 0) || 0,
      reward: Number(row.reward ?? 0) || 0,
    }))
    .filter((row) => Boolean(row.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

let memoryCache: DmmAffiliateCachePayload | null = null;

export function loadDmmAffiliateCache(): DmmAffiliateCachePayload {
  return memoryCache ?? createEmptyDmmAffiliateCache();
}

export function saveDmmAffiliateCache(payload: DmmAffiliateCachePayload): void {
  memoryCache = payload;
}

export async function refreshDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  const jsonEnv = process.env.DMM_AFFILIATE_REPORT_JSON?.trim();
  const reportUrl = process.env.DMM_AFFILIATE_REPORT_URL?.trim();

  if (!jsonEnv && !reportUrl) {
    const empty = createEmptyDmmAffiliateCache();
    saveDmmAffiliateCache(empty);
    return empty;
  }

  try {
    let raw: unknown;
    if (jsonEnv) {
      raw = JSON.parse(jsonEnv);
    } else {
      const response = await fetch(reportUrl!, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`DMM report fetch failed: HTTP ${response.status}`);
      }
      raw = await response.json();
    }

    const daily = parseExternalReport(raw);
    const end = new Date();
    const today = formatDate(end);
    const yesterday = formatDate(subtractDays(end, 1));
    const start7 = formatDate(subtractDays(end, 6));
    const start28 = formatDate(subtractDays(end, 27));

    const payload: DmmAffiliateCachePayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      configured: true,
      connectionStatus: "connected",
      periods: {
        today: sumDaily(daily, today, today),
        yesterday: sumDaily(daily, yesterday, yesterday),
        "7d": sumDaily(daily, start7, today),
        "28d": sumDaily(daily, start28, today),
      },
      daily: daily.slice(-90),
    };

    saveDmmAffiliateCache(payload);
    return payload;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "DMMアフィリエイト成果の取得に失敗しました。";
    const payload: DmmAffiliateCachePayload = {
      ...createEmptyDmmAffiliateCache(message),
      connectionStatus: "error",
      fetchError: message,
      configured: true,
    };
    saveDmmAffiliateCache(payload);
    return payload;
  }
}

export async function getDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  const cached = loadDmmAffiliateCache();
  if (cached.updatedAt) return cached;
  return refreshDmmAffiliateData();
}
