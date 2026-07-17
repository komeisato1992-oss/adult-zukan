import {
  metricsFromDaily,
  resolveGscMetrics,
} from "@/components/admin/ops/ops-dashboard-utils";
import type { OpsDashboardPayload } from "@/lib/admin/ops-types";
import type { Ga4MetricSnapshot } from "@/lib/admin/ga4-types";
import type { DmmAffiliateMetrics } from "@/lib/admin/dmm-report-types";
import type { SeoPeriodMetrics } from "@/lib/admin/seo-types";

/** 概要タブ共通の期間（既存キャッシュ期間へマッピング） */
export type OverviewPeriodId = "today" | "yesterday" | "7" | "30";

export const OVERVIEW_PERIOD_OPTIONS: Array<{
  id: OverviewPeriodId;
  label: string;
}> = [
  { id: "today", label: "今日" },
  { id: "yesterday", label: "昨日" },
  { id: "7", label: "7日" },
  { id: "30", label: "30日" },
];

function emptyGa4(): Ga4MetricSnapshot {
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

function emptyDmm(): DmmAffiliateMetrics {
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

function jstYesterdayKey(): string {
  const end = new Date();
  const jst = new Date(end.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() - 1);
  return jst.toISOString().slice(0, 10);
}

function dmmFromDaily(
  daily: OpsDashboardPayload["dmm"]["daily"],
  dateKey: string,
): DmmAffiliateMetrics {
  const row = daily.find((item) => item.date === dateKey);
  if (!row) return emptyDmm();
  return {
    reward: row.reward,
    count: row.count,
    sales: row.sales,
    avgReward: row.count > 0 ? row.reward / row.count : 0,
    categoryReward: row.categoryReward,
    directReward: row.directReward,
    categoryCount: row.categoryCount,
    directCount: row.directCount,
    categorySales: row.categorySales,
    directSales: row.directSales,
  };
}

export type OverviewPeriodMetrics = {
  gsc: { current: SeoPeriodMetrics; previous: SeoPeriodMetrics };
  ga4: { current: Ga4MetricSnapshot; previous: Ga4MetricSnapshot };
  dmm: { current: DmmAffiliateMetrics; previous: DmmAffiliateMetrics };
};

export function resolveOverviewPeriodMetrics(
  data: OpsDashboardPayload,
  period: OverviewPeriodId,
): OverviewPeriodMetrics {
  if (period === "today") {
    return {
      gsc: {
        current: metricsFromDaily(data.seo.dailyStats, 1),
        previous: metricsFromDaily(data.seo.dailyStats, 1, 1),
      },
      ga4: {
        current: data.ga4.periods[1]?.current ?? emptyGa4(),
        previous: data.ga4.periods[1]?.previous ?? emptyGa4(),
      },
      dmm: {
        current: data.dmm.periods.today,
        previous: dmmFromDaily(data.dmm.daily, jstYesterdayKey()),
      },
    };
  }

  if (period === "yesterday") {
    const yKey = jstYesterdayKey();
    const dayBefore = (() => {
      const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      jst.setUTCDate(jst.getUTCDate() - 2);
      return jst.toISOString().slice(0, 10);
    })();
    return {
      gsc: {
        current: metricsFromDaily(data.seo.dailyStats, 1, 1),
        previous: metricsFromDaily(data.seo.dailyStats, 1, 2),
      },
      ga4: {
        // 1日期間の previous を「昨日」相当として利用
        current: data.ga4.periods[1]?.previous ?? emptyGa4(),
        previous: emptyGa4(),
      },
      dmm: {
        current: dmmFromDaily(data.dmm.daily, yKey),
        previous: dmmFromDaily(data.dmm.daily, dayBefore),
      },
    };
  }

  if (period === "7") {
    return {
      gsc: resolveGscMetrics(data.seo, "7"),
      ga4: {
        current: data.ga4.periods[7]?.current ?? emptyGa4(),
        previous: data.ga4.periods[7]?.previous ?? emptyGa4(),
      },
      dmm: {
        current: data.dmm.periods["7d"],
        previous: emptyDmm(),
      },
    };
  }

  // 30日 → 既存の28日キャッシュを利用（集計ロジックは変更しない）
  return {
    gsc: resolveGscMetrics(data.seo, "28"),
    ga4: {
      current: data.ga4.periods[28]?.current ?? emptyGa4(),
      previous: data.ga4.periods[28]?.previous ?? emptyGa4(),
    },
    dmm: {
      current: data.dmm.periods["28d"],
      previous: emptyDmm(),
    },
  };
}
