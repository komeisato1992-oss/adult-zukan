import "server-only";

import { buildDmmAiInsights } from "@/lib/admin/dmm-report-insights";
import {
  invalidateDmmReportsMemoryCache,
  importDmmReportsText,
  loadDmmReportsDocument,
} from "@/lib/admin/dmm-report-store";
import type {
  DmmAffiliateCachePayload,
  DmmAffiliateDailyPoint,
  DmmAffiliateMetrics,
  DmmAffiliatePeriod,
  DmmReportRow,
} from "@/lib/admin/dmm-report-types";

export type {
  DmmAffiliateCachePayload,
  DmmAffiliateDailyPoint,
  DmmAffiliateMetrics,
  DmmAffiliatePeriod,
} from "@/lib/admin/dmm-report-types";

function emptyMetrics(): DmmAffiliateMetrics {
  return {
    clicks: 0,
    conversions: 0,
    conversionRate: 0,
    reward: 0,
    categoryReward: 0,
    directReward: 0,
    clickUnitPrice: 0,
    conversionUnitPrice: 0,
  };
}

function withDerived(input: {
  clicks: number;
  conversions: number;
  reward: number;
  categoryReward: number;
  directReward: number;
}): DmmAffiliateMetrics {
  return {
    clicks: input.clicks,
    conversions: input.conversions,
    conversionRate:
      input.clicks > 0 ? input.conversions / input.clicks : 0,
    reward: input.reward,
    categoryReward: input.categoryReward,
    directReward: input.directReward,
    clickUnitPrice: input.clicks > 0 ? input.reward / input.clicks : 0,
    conversionUnitPrice:
      input.conversions > 0 ? input.reward / input.conversions : 0,
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

function sumRows(
  rows: DmmReportRow[],
  startInclusive: string,
  endInclusive: string,
): DmmAffiliateMetrics {
  let clicks = 0;
  let conversions = 0;
  let reward = 0;
  let categoryReward = 0;
  let directReward = 0;

  for (const row of rows) {
    if (row.date < startInclusive || row.date > endInclusive) continue;
    clicks += row.clicks;
    conversions += row.sales;
    reward += row.reward;
    categoryReward += row.category_reward;
    directReward += row.direct_reward;
  }

  return withDerived({
    clicks,
    conversions,
    reward,
    categoryReward,
    directReward,
  });
}

function toDailyPoints(rows: DmmReportRow[]): DmmAffiliateDailyPoint[] {
  return rows.map((row) => ({
    date: row.date,
    clicks: row.clicks,
    conversions: row.sales,
    reward: row.reward,
    categoryReward: row.category_reward,
    directReward: row.direct_reward,
  }));
}

export function createEmptyDmmAffiliateCache(
  message?: string,
): DmmAffiliateCachePayload {
  return {
    version: 2,
    updatedAt: null,
    importedAt: null,
    configured: false,
    configMessage:
      message ??
      "DMM成果データが未取込です。/admin/dmm から JSON または CSV をアップロードしてください。",
    connectionStatus: "unconfigured",
    rowCount: 0,
    dateRange: { start: null, end: null },
    source: null,
    fileName: null,
    periods: {
      today: emptyMetrics(),
      yesterday: emptyMetrics(),
      "7d": emptyMetrics(),
      "28d": emptyMetrics(),
      "90d": emptyMetrics(),
    },
    daily: [],
    insights: {
      highConversionWorks: [],
      lowConversionWorks: [],
      topRewardGenres: [],
      topRewardActresses: [],
      topRewardMakers: [],
    },
  };
}

function buildPayloadFromRows(
  rows: DmmReportRow[],
  meta: {
    updatedAt: string | null;
    importedAt: string | null;
    source: DmmAffiliateCachePayload["source"];
    fileName: string | null;
    entities: Parameters<typeof buildDmmAiInsights>[0];
  },
): DmmAffiliateCachePayload {
  if (rows.length === 0) {
    return createEmptyDmmAffiliateCache();
  }

  const end = new Date();
  const today = formatDate(end);
  const yesterday = formatDate(subtractDays(end, 1));
  const start7 = formatDate(subtractDays(end, 6));
  const start28 = formatDate(subtractDays(end, 27));
  const start90 = formatDate(subtractDays(end, 89));
  const dates = rows.map((row) => row.date).sort();

  return {
    version: 2,
    updatedAt: meta.updatedAt,
    importedAt: meta.importedAt,
    configured: true,
    connectionStatus: "connected",
    rowCount: rows.length,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
    source: meta.source,
    fileName: meta.fileName,
    periods: {
      today: sumRows(rows, today, today),
      yesterday: sumRows(rows, yesterday, yesterday),
      "7d": sumRows(rows, start7, today),
      "28d": sumRows(rows, start28, today),
      "90d": sumRows(rows, start90, today),
    },
    daily: toDailyPoints(rows).slice(-120),
    insights: buildDmmAiInsights(meta.entities),
  };
}

export async function getDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  try {
    const { document } = await loadDmmReportsDocument();
    return buildPayloadFromRows(document.rows, {
      updatedAt: document.updatedAt,
      importedAt: document.importedAt,
      source: document.source,
      fileName: document.fileName,
      entities: document.entities,
    });
  } catch (error) {
    return createEmptyDmmAffiliateCache(
      error instanceof Error
        ? error.message
        : "DMM成果データの読み込みに失敗しました。",
    );
  }
}

/** 保存済みデータを再集計。環境変数があれば追加取込も試みる */
export async function refreshDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  invalidateDmmReportsMemoryCache();

  const jsonEnv = process.env.DMM_AFFILIATE_REPORT_JSON?.trim();
  const reportUrl = process.env.DMM_AFFILIATE_REPORT_URL?.trim();

  try {
    if (jsonEnv) {
      await importDmmReportsText({
        text: jsonEnv,
        format: "json",
        source: "env",
        fileName: "DMM_AFFILIATE_REPORT_JSON",
      });
    } else if (reportUrl) {
      const response = await fetch(reportUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`DMM report fetch failed: HTTP ${response.status}`);
      }
      const text = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const format =
        contentType.includes("csv") || reportUrl.endsWith(".csv")
          ? "csv"
          : "json";
      await importDmmReportsText({
        text,
        format,
        source: "url",
        fileName: reportUrl,
      });
    }
  } catch (error) {
    const base = await getDmmAffiliateData();
    return {
      ...base,
      connectionStatus: base.rowCount > 0 ? "connected" : "error",
      fetchError:
        error instanceof Error
          ? error.message
          : "外部レポートの再取込に失敗しました。",
    };
  }

  return getDmmAffiliateData();
}

export type DmmAdminStatus = {
  updatedAt: string | null;
  importedAt: string | null;
  rowCount: number;
  dateRange: { start: string | null; end: string | null };
  source: DmmAffiliateCachePayload["source"];
  fileName: string | null;
  dashboard: DmmAffiliateCachePayload;
};

export async function getDmmAdminStatus(): Promise<DmmAdminStatus> {
  const dashboard = await getDmmAffiliateData();
  return {
    updatedAt: dashboard.updatedAt,
    importedAt: dashboard.importedAt,
    rowCount: dashboard.rowCount,
    dateRange: dashboard.dateRange,
    source: dashboard.source,
    fileName: dashboard.fileName,
    dashboard,
  };
}
