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
  DmmEntityStat,
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

function topByReward(entities: DmmEntityStat[], kind: DmmEntityStat["kind"]) {
  return entities
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.reward - a.reward || b.sales - a.sales)
    .slice(0, 10);
}

function hasAutoSource(): boolean {
  return Boolean(
    process.env.DMM_AFFILIATE_REPORT_URL?.trim() ||
      process.env.DMM_AFFILIATE_REPORT_JSON?.trim() ||
      process.env.DMM_AFFILIATE_REPORT_CSV?.trim(),
  );
}

export function createEmptyDmmAffiliateCache(
  message?: string,
): DmmAffiliateCachePayload {
  const auto = hasAutoSource();
  return {
    version: 3,
    updatedAt: null,
    importedAt: null,
    lastSuccessfulAt: null,
    configured: auto,
    configMessage:
      message ??
      (auto
        ? "DMM成果の自動取得設定があります。更新ボタンまたはCronで取得してください。"
        : "DMM_AFFILIATE_REPORT_URL / DMM_AFFILIATE_REPORT_JSON / DMM_AFFILIATE_REPORT_CSV を設定するか、/admin/dmm から手動取込してください。"),
    connectionStatus: auto ? "error" : "unconfigured",
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
    rankings: { works: [], actresses: [] },
  };
}

function buildPayloadFromRows(
  rows: DmmReportRow[],
  meta: {
    updatedAt: string | null;
    importedAt: string | null;
    lastSuccessfulAt: string | null;
    source: DmmAffiliateCachePayload["source"];
    fileName: string | null;
    entities: DmmEntityStat[];
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
          ? `前回取得日時: ${meta.lastSuccessfulAt}`
          : meta.fetchError
        : empty.configMessage,
    };
  }

  const end = new Date();
  const today = formatDate(end);
  const yesterday = formatDate(subtractDays(end, 1));
  const start7 = formatDate(subtractDays(end, 6));
  const start28 = formatDate(subtractDays(end, 27));
  const start90 = formatDate(subtractDays(end, 89));
  const dates = rows.map((row) => row.date).sort();
  const insights = buildDmmAiInsights(meta.entities);

  return {
    version: 3,
    updatedAt: meta.updatedAt,
    importedAt: meta.importedAt,
    lastSuccessfulAt: meta.lastSuccessfulAt,
    configured: true,
    connectionStatus: meta.connectionStatus ?? "connected",
    fetchError: meta.fetchError,
    configMessage: meta.fetchError
      ? `前回取得日時: ${meta.lastSuccessfulAt ?? meta.updatedAt}`
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
      yesterday: sumRows(rows, yesterday, yesterday),
      "7d": sumRows(rows, start7, today),
      "28d": sumRows(rows, start28, today),
      "90d": sumRows(rows, start90, today),
    },
    daily: toDailyPoints(rows).slice(-120),
    insights,
    rankings: {
      works: topByReward(meta.entities, "work"),
      actresses: topByReward(meta.entities, "actress"),
    },
  };
}

/** キャッシュ優先（APIは叩かない） */
export async function getDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  try {
    const { document } = await loadDmmReportsDocument();
    return buildPayloadFromRows(document.rows, {
      updatedAt: document.updatedAt,
      importedAt: document.importedAt,
      lastSuccessfulAt: document.updatedAt,
      source: document.source,
      fileName: document.fileName,
      entities: document.entities,
      connectionStatus:
        document.rows.length > 0
          ? "connected"
          : hasAutoSource()
            ? "error"
            : "unconfigured",
    });
  } catch (error) {
    return createEmptyDmmAffiliateCache(
      error instanceof Error
        ? error.message
        : "DMM成果データの読み込みに失敗しました。",
    );
  }
}

async function importFromEnvSources(): Promise<boolean> {
  const reportUrl = process.env.DMM_AFFILIATE_REPORT_URL?.trim();
  const jsonEnv = process.env.DMM_AFFILIATE_REPORT_JSON?.trim();
  const csvEnv = process.env.DMM_AFFILIATE_REPORT_CSV?.trim();

  // 優先: URL → JSON → CSV
  if (reportUrl) {
    const response = await fetch(reportUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`DMM report fetch failed: HTTP ${response.status}`);
    }
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const format =
      contentType.includes("csv") ||
      reportUrl.toLowerCase().endsWith(".csv") ||
      (!text.trim().startsWith("{") && !text.trim().startsWith("["))
        ? "csv"
        : "json";
    await importDmmReportsText({
      text,
      format,
      source: "url",
      fileName: reportUrl,
    });
    return true;
  }

  if (jsonEnv) {
    await importDmmReportsText({
      text: jsonEnv,
      format: "json",
      source: "env",
      fileName: "DMM_AFFILIATE_REPORT_JSON",
    });
    return true;
  }

  if (csvEnv) {
    await importDmmReportsText({
      text: csvEnv,
      format: "csv",
      source: "env",
      fileName: "DMM_AFFILIATE_REPORT_CSV",
    });
    return true;
  }

  return false;
}

/** 環境変数ソースから自動取込し、失敗時は前回データを保持 */
export async function refreshDmmAffiliateData(): Promise<DmmAffiliateCachePayload> {
  const previous = await getDmmAffiliateData();
  invalidateDmmReportsMemoryCache();

  try {
    const imported = await importFromEnvSources();
    if (!imported && previous.rowCount === 0) {
      return createEmptyDmmAffiliateCache();
    }
    const next = await getDmmAffiliateData();
    return {
      ...next,
      lastSuccessfulAt: next.updatedAt ?? previous.lastSuccessfulAt,
      connectionStatus: next.rowCount > 0 ? "connected" : next.connectionStatus,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "外部レポートの再取込に失敗しました。";
    return {
      ...previous,
      connectionStatus: previous.rowCount > 0 ? "stale" : "error",
      fetchError: message,
      configMessage: previous.lastSuccessfulAt
        ? `前回取得日時: ${previous.lastSuccessfulAt}`
        : message,
    };
  }
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
    autoConfigured: hasAutoSource(),
    dashboard,
  };
}
