import "server-only";

import { getAdminSiteStats } from "@/lib/admin/stats";
import {
  getSeoDashboardData,
  refreshSeoDashboardData,
} from "@/lib/admin/seo-service";
import {
  getGa4DashboardData,
  refreshGa4DashboardData,
} from "@/lib/admin/ga4-service";
import {
  getDmmAffiliateData,
  refreshDmmAffiliateData,
} from "@/lib/admin/dmm-affiliate-service";
import { computeOpsSeoScore } from "@/lib/admin/ops-score";
import {
  buildOpsSuggestions,
  buildOpsTasks,
} from "@/lib/admin/ops-suggestions";
import { buildOpsAlerts } from "@/lib/admin/ops-alerts";
import type { OpsDashboardPayload } from "@/lib/admin/ops-types";

function latestUpdatedAt(
  values: Array<string | null | undefined>,
): string | null {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

export async function getOpsDashboardData(): Promise<OpsDashboardPayload> {
  const [stats, seoDashboard, ga4, dmm] = await Promise.all([
    getAdminSiteStats(),
    getSeoDashboardData(),
    getGa4DashboardData(),
    getDmmAffiliateData(),
  ]);

  const seo = seoDashboard.data;
  const suggestions = buildOpsSuggestions(seo, ga4);
  const tasks = buildOpsTasks(seo, suggestions);
  const alerts = buildOpsAlerts(seo, ga4, dmm);
  const seoScore = computeOpsSeoScore(seo, ga4);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    top: {
      catalog: {
        works: stats.works,
        actresses: stats.actresses,
        makers: stats.makers,
        labels: stats.labels,
        series: stats.series,
        genres: stats.genres,
      },
      indexedPages: seo.index.indexedPages,
      notIndexedPages: seo.index.notIndexedPages,
      indexRate: seo.index.registrationRate,
      updatedAt: latestUpdatedAt([
        seo.updatedAt,
        ga4.updatedAt,
        dmm.updatedAt,
      ]),
    },
    seoScore,
    suggestions,
    tasks,
    alerts,
    seo,
    ga4,
    dmm,
  };
}

export async function refreshOpsDashboardData(): Promise<OpsDashboardPayload> {
  const results = await Promise.allSettled([
    refreshSeoDashboardData(),
    refreshGa4DashboardData(),
    refreshDmmAffiliateData(),
  ]);

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) =>
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown refresh error",
    );

  const payload = await getOpsDashboardData();

  if (errors.length > 0) {
    payload.alerts = [
      {
        id: "refresh-partial-fail",
        title: "API取得失敗",
        detail: errors.join(" / "),
        severity: "critical",
      },
      ...payload.alerts.filter((alert) => alert.id !== "refresh-partial-fail"),
    ];
  }

  return payload;
}
