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
import { buildGscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";
import {
  ensureSeoAudits,
  refreshSeoAudits,
} from "@/lib/admin/seo-audit-store";
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

  const indexRate =
    seo.index.indexedPages != null && indexableUrlCount != null && indexableUrlCount > 0
      ? seo.index.indexedPages / indexableUrlCount
      : seo.index.registrationRate;

  return {
    version: 2,
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
      notIndexedPages:
        seo.index.notIndexedPages != null &&
        seo.index.indexedSource === "sitemap"
          ? seo.index.notIndexedPages
          : null,
      indexRate,
      indexEstimated:
        seo.index.indexedSource === "sitemap" ||
        seo.index.indexedSource === "search_impressions" ||
        seo.index.indexedSource === "estimated",
      indexableUrlCount,
      updatedAt: latestUpdatedAt([
        seo.updatedAt,
        ga4.updatedAt,
        dmm.updatedAt,
        audits.internalLinks?.inspectedAt,
        audits.structuredData?.inspectedAt,
      ]),
    },
    seoScore,
    suggestions,
    tasks,
    alerts,
    sitemapSummary,
    internalLinkAudit: audits.internalLinks,
    structuredDataAudit: audits.structuredData,
    seo,
    ga4,
    dmm,
  };
}

export async function getOpsDashboardData(): Promise<OpsDashboardPayload> {
  return buildOpsPayload(false);
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
    .map((result) =>
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown refresh error",
    );

  const payload = await buildOpsPayload(false);

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
