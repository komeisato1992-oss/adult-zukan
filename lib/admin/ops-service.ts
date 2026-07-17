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
import type {
  OpsDashboardPayload,
  OpsRefreshSource,
} from "@/lib/admin/ops-types";
import { buildGscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";
import {
  ensureSeoAudits,
  refreshSeoAudits,
} from "@/lib/admin/seo-audit-store";
import { buildOpsAnalyticsKpis } from "@/lib/admin/ops-analytics-kpis";
import { getSitemapEntries } from "@/lib/sitemap/build-entries";

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

async function buildOpsPayload(
  refreshAudits: boolean,
): Promise<OpsDashboardPayload> {
  const [stats, seoDashboard, ga4, dmm] = await Promise.all([
    getAdminSiteStats(),
    getSeoDashboardData(),
    getGa4DashboardData(),
    getDmmAffiliateData(),
  ]);

  const seo = seoDashboard.data;
  const audits = refreshAudits
    ? await refreshSeoAudits()
    : await ensureSeoAudits();

  const sitemapSummary = buildGscSitemapSummary({
    configured: seo.configured,
    sitemaps: seo.sitemaps,
    fetchedAt: seo.sitemapStatus?.fetchedAt ?? null,
    fetchError: seo.sitemapStatus?.fetchError,
    worksCount: seo.overview.totalWorks,
    siteUrl: seo.siteUrl,
  });

  let indexableUrlCount: number | null = null;
  try {
    indexableUrlCount = (await getSitemapEntries()).length;
  } catch {
    indexableUrlCount = null;
  }

  const seoScore = await computeOpsSeoScore({
    seo,
    ga4,
    internalLinkAudit: audits.internalLinks,
    structuredDataAudit: audits.structuredData,
  });

  const suggestions = buildOpsSuggestions(seo, ga4, dmm, seoScore, sitemapSummary);
  const tasks = buildOpsTasks(seo, suggestions);
  const alerts = buildOpsAlerts(seo, ga4, dmm, sitemapSummary);

  // Google登録ページ数は Search Console 由来（sitemap / search_impressions）のみ。推定は表示しない。
  const indexedPages =
    seo.index.indexedSource === "sitemap" ||
    seo.index.indexedSource === "search_impressions"
      ? seo.index.indexedPages
      : null;

  const indexRate =
    seo.index.indexedSource === "sitemap" && seo.index.registrationRate != null
      ? seo.index.registrationRate
      : indexedPages != null &&
          indexableUrlCount != null &&
          indexableUrlCount > 0
        ? indexedPages / indexableUrlCount
        : null;

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    top: {
      catalog: {
        // 掲載中作品数（getPublishedWorkCount → getCatalogWorks）に統一
        works: stats.works,
        actresses: stats.actresses,
        makers: stats.makers,
        labels: stats.labels,
        series: stats.series,
        genres: stats.genres,
      },
      indexedPages,
      notIndexedPages:
        seo.index.notIndexedPages != null &&
        seo.index.indexedSource === "sitemap"
          ? seo.index.notIndexedPages
          : null,
      indexRate,
      indexEstimated: seo.index.indexedSource === "search_impressions",
      indexableUrlCount:
        seo.index.totalSitePages > 0
          ? seo.index.totalSitePages
          : indexableUrlCount,
      updatedAt: latestUpdatedAt([
        seo.updatedAt,
        ga4.updatedAt,
        ga4.lastSuccessfulAt,
        dmm.updatedAt,
        dmm.lastSuccessfulAt,
        audits.internalLinks?.inspectedAt,
        audits.structuredData?.inspectedAt,
      ]),
    },
    analyticsKpis: buildOpsAnalyticsKpis(seo, ga4, dmm),
    seoScore,
    suggestions,
    tasks,
    alerts,
    sitemapSummary,
    internalLinkAudit: audits.internalLinks,
    structuredDataAudit: audits.structuredData,
    seo: {
      ...seo,
      // UI の作品数と overview を常に掲載中件数へ揃える
      overview: {
        ...seo.overview,
        totalWorks: stats.works,
      },
    },
    ga4,
    dmm,
  };
}

export async function getOpsDashboardData(): Promise<OpsDashboardPayload> {
  return buildOpsPayload(false);
}

export type { OpsRefreshSource };

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown refresh error";
}

async function attachRefreshErrors(
  payload: OpsDashboardPayload,
  errors: string[],
): Promise<OpsDashboardPayload> {
  if (errors.length === 0) return payload;
  return {
    ...payload,
    alerts: [
      {
        id: "refresh-partial-fail",
        title: "API取得失敗",
        detail: errors.join(" / "),
        severity: "critical",
      },
      ...payload.alerts.filter((alert) => alert.id !== "refresh-partial-fail"),
    ],
  };
}

/** Search Console / サイトマップのみ更新してダッシュボードを再構築 */
export async function refreshOpsSeoSource(): Promise<OpsDashboardPayload> {
  try {
    await refreshSeoDashboardData();
    return buildOpsPayload(false);
  } catch (error) {
    const message = errorMessage(error);
    const payload = await buildOpsPayload(false);
    return {
      ...payload,
      seo: {
        ...payload.seo,
        connectionStatus: "error",
        stale: Boolean(payload.seo.updatedAt),
        fetchError: message,
        configMessage: payload.seo.updatedAt
          ? `${payload.seo.updatedAt}時点のキャッシュを表示しています（今回の保存/取得は失敗）`
          : message,
      },
      alerts: [
        {
          id: "refresh-partial-fail",
          title: "Search Console更新失敗",
          detail: message,
          severity: "critical",
        },
        ...payload.alerts.filter((alert) => alert.id !== "refresh-partial-fail"),
      ],
    };
  }
}

/** GA4のみ更新してダッシュボードを再構築 */
export async function refreshOpsGa4Source(): Promise<OpsDashboardPayload> {
  const errors: string[] = [];
  try {
    await refreshGa4DashboardData();
  } catch (error) {
    errors.push(errorMessage(error));
  }
  return attachRefreshErrors(await buildOpsPayload(false), errors);
}

/** DMMのみ更新してダッシュボードを再構築 */
export async function refreshOpsDmmSource(): Promise<OpsDashboardPayload> {
  const errors: string[] = [];
  try {
    await refreshDmmAffiliateData();
  } catch (error) {
    errors.push(errorMessage(error));
  }
  return attachRefreshErrors(await buildOpsPayload(false), errors);
}

/** SEO監査・スコア・改善提案を再生成してダッシュボードを再構築 */
export async function refreshOpsScoreSource(): Promise<OpsDashboardPayload> {
  const errors: string[] = [];
  try {
    await refreshSeoAudits();
  } catch (error) {
    errors.push(errorMessage(error));
  }
  return attachRefreshErrors(await buildOpsPayload(false), errors);
}

export async function refreshOpsSource(
  source: OpsRefreshSource,
): Promise<OpsDashboardPayload> {
  switch (source) {
    case "seo":
      return refreshOpsSeoSource();
    case "ga4":
      return refreshOpsGa4Source();
    case "dmm":
      return refreshOpsDmmSource();
    case "score":
      return refreshOpsScoreSource();
    case "all":
    default:
      return refreshOpsDashboardData();
  }
}

export async function refreshOpsDashboardData(): Promise<OpsDashboardPayload> {
  const results = await Promise.allSettled([
    refreshSeoDashboardData(),
    refreshGa4DashboardData(),
    refreshDmmAffiliateData(),
    refreshSeoAudits(),
  ]);

  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => errorMessage(result.reason));

  return attachRefreshErrors(await buildOpsPayload(false), errors);
}
