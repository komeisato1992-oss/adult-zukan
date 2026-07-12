import "server-only";

import {
  invalidateDmmReportsMemoryCache,
  loadDmmReportsDocument,
} from "@/lib/admin/dmm-report-store";
import type {
  DmmAffiliateCachePayload,
  DmmAffiliateDailyPoint,
  DmmAffiliateMetrics,
  DmmAffiliatePeriod,
  DmmRewardRow,
} from "@/lib/admin/dmm-report-types";

export type {
  DmmAffiliateCachePayload,
  DmmAffiliateDailyPoint,
  DmmAffiliateMetrics,
  DmmAffiliatePeriod,
  DmmTypeBreakdownRow,
} from "@/lib/admin/dmm-report-types";

export { buildTypeBreakdown } from "@/lib/admin/dmm-metrics";

function emptyMetrics(): DmmAffiliateMetrics {
  return {
    reward: 0,
    count: 0,
    sales: 0,
    avgReward: 0,
    categoryReward: 0,
    directReward: 0,
    categoryCount: 0,
    directCount: 0,
    categorySales: 0,
    directSales: 0,
  };
}

function withAvg(metrics: Omit<DmmAffiliateMetrics, "avgReward">): DmmAffiliateMetrics {
  return {
    ...metrics,
    avgReward: metrics.count > 0 ? metrics.reward / metrics.count : 0,
  };
}

function formatDate(date: Date): string {
  // JST日付（運営ダッシュボード向け）
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function sumRows(
  rows: DmmRewardRow[],
  startInclusive: string,
  endInclusive: string,
): DmmAffiliateMetrics {
  let reward = 0;
  let count = 0;
  let sales = 0;
  let categoryReward = 0;
  let directReward = 0;
  let categoryCount = 0;
  let directCount = 0;
  let categorySales = 0;
  let directSales = 0;

  for (const row of rows) {
    if (row.date < startInclusive || row.date > endInclusive) continue;
    reward += row.reward;
    count += row.count;
    sales += row.sales;
    if (row.type === "category") {
      categoryReward += row.reward;
      categoryCount += row.count;
      categorySales += row.sales;
    } else {
      directReward += row.reward;
      directCount += row.count;
      directSales += row.sales;
    }
  }

  return withAvg({
    reward,
    count,
    sales,
    categoryReward,
    directReward,
    categoryCount,
    directCount,
    categorySales,
    directSales,
  });
}

function toDailyPoints(rows: DmmRewardRow[]): DmmAffiliateDailyPoint[] {
  const byDate = new Map<string, DmmAffiliateDailyPoint>();

  for (const row of rows) {
    const current = byDate.get(row.date) ?? {
      date: row.date,
      categoryReward: 0,
      directReward: 0,
      reward: 0,
      categoryCount: 0,
      directCount: 0,
      categorySales: 0,
      directSales: 0,
      count: 0,
      sales: 0,
    };

    if (row.type === "category") {
      current.categoryReward += row.reward;
      current.categoryCount += row.count;
      current.categorySales += row.sales;
    } else {
      current.directReward += row.reward;
      current.directCount += row.count;
      current.directSales += row.sales;
    }
    current.reward = current.categoryReward + current.directReward;
    current.count = current.categoryCount + current.directCount;
    current.sales = current.categorySales + current.directSales;
    byDate.set(row.date, current);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function createEmptyDmmAffiliateCache(
  message?: string,
): DmmAffiliateCachePayload {
  return {
    version: 4,
    updatedAt: null,
    importedAt: null,
    lastSuccessfulAt: null,
    configured: true,
    configMessage:
      message ??
      "カテゴリCSV / ダイレクトCSVをアップロードしてください。",
    connectionStatus: "unconfigured",
    rowCount: 0,
    dateRange: { start: null, end: null },
    source: null,
    fileName: null,
    periods: {
      today: emptyMetrics(),
      "7d": emptyMetrics(),
      "28d": emptyMetrics(),
      "365d": emptyMetrics(),
    },
    daily: [],
    insights: {
      highConversionWorks: [],
      lowConversionWorks: [],
      topRewardGenres: [],
      topRewardActresses: [],
      topRewardMakers: [],
    },
    rankings: { works: [], actresses: [] },
  };
}

function buildPayloadFromRows(
  rows: DmmRewardRow[],
  meta: {
    updatedAt: string | null;
    importedAt: string | null;
    lastSuccessfulAt: string | null;
    source: DmmAffiliateCachePayload["source"];
    fileName: string | null;
    fetchError?: string;
    connectionStatus?: DmmAffiliateCachePayload["connectionStatus"];
  },
): DmmAffiliateCachePayload {
  if (rows.length === 0) {
    const empty = createEmptyDmmAffiliateCache();
    return {
      ...empty,
      lastSuccessfulAt: meta.lastSuccessfulAt,
      fetchError: meta.fetchError,
      connectionStatus: meta.connectionStatus ?? empty.connectionStatus,
      configMessage: meta.fetchError
        ? meta.lastSuccessfulAt
          ? `${meta.lastSuccessfulAt}時点のキャッシュを表示しています`
          : meta.fetchError
        : empty.configMessage,
    };
  }

  const end = new Date();
  const today = formatDate(end);
  const start7 = formatDate(subtractDays(end, 6));
  const start28 = formatDate(subtractDays(end, 27));
  const start365 = formatDate(subtractDays(end, 364));
  const dates = rows.map((row) => row.date).sort();

  return {
    version: 4,
    updatedAt: meta.updatedAt,
    importedAt: meta.importedAt,
    lastSuccessfulAt: meta.lastSuccessfulAt,
    configured: true,
    connectionStatus: meta.connectionStatus ?? "connected",
    fetchError: meta.fetchError,
    configMessage: meta.fetchError
      ? `${meta.lastSuccessfulAt ?? meta.updatedAt}時点のキャッシュを表示しています`
      : undefined,
    rowCount: rows.length,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
    source: meta.source,
    fileName: meta.fileName,
    periods: {
      today: sumRows(rows, today, today),
      "7d": sumRows(rows, start7, today),
      "28d": sumRows(rows, start28, today),
      "365d": sumRows(rows, start365, today),
    },
    daily: toDailyPoints(rows).slice(-400),
    insights: {
      highConversionWorks: [],
      lowConversionWorks: [],
      topRewardGenres: [],
      topRewardActresses: [],
      topRewardMakers: [],
    },
    rankings: { works: [], actresses: [] },
  };
}

/** キャッシュ優先（外部APIは叩かない） */
export async function getDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  try {
    const { document } = await loadDmmReportsDocument();
    return buildPayloadFromRows(document.rows, {
      updatedAt: document.updatedAt,
      importedAt: document.importedAt,
      lastSuccessfulAt: document.updatedAt,
      source: document.source,
      fileName: document.fileName,
      connectionStatus:
        document.rows.length > 0 ? "connected" : "unconfigured",
    });
  } catch (error) {
    return createEmptyDmmAffiliateCache(
      error instanceof Error
        ? error.message
        : "DMM成果データの読み込みに失敗しました。",
    );
  }
}

/** CSV手動取込以外の自動取得は廃止。キャッシュ再読込のみ */
export async function refreshDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  invalidateDmmReportsMemoryCache();
  return getDmmAffiliateData();
}

export type DmmAdminStatus = {
  updatedAt: string | null;
  importedAt: string | null;
  lastSuccessfulAt: string | null;
  rowCount: number;
  dateRange: { start: string | null; end: string | null };
  source: DmmAffiliateCachePayload["source"];
  fileName: string | null;
  autoConfigured: boolean;
  dashboard: DmmAffiliateCachePayload;
};

export async function getDmmAdminStatus(): Promise<DmmAdminStatus> {
  const dashboard = await getDmmAffiliateData();
  return {
    updatedAt: dashboard.updatedAt,
    importedAt: dashboard.importedAt,
    lastSuccessfulAt: dashboard.lastSuccessfulAt,
    rowCount: dashboard.rowCount,
    dateRange: dashboard.dateRange,
    source: dashboard.source,
    fileName: dashboard.fileName,
    autoConfigured: false,
    dashboard,
  };
}
