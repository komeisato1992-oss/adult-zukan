import type { AdminSiteStats } from "@/lib/admin/stats";
import type { Ga4CachePayload } from "@/lib/admin/ga4-types";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-report-types";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type { OpsSeoScore } from "@/lib/admin/ops-score";
import type { GscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";
import type { InternalLinkAuditResult } from "@/lib/admin/seo-audit-internal-links";
import type { StructuredDataAuditResult } from "@/lib/admin/seo-audit-structured-data";
import type { OpsAnalyticsKpis } from "@/lib/admin/ops-analytics-kpis";

export type OpsGscPeriod = "1" | "7" | "28" | "90";
export type OpsDmmPeriod = "today" | "7d" | "28d" | "365d";
export type OpsGa4Period = 1 | 7 | 28 | 90;
export type OpsRefreshSource = "seo" | "ga4" | "dmm" | "all";

/** @deprecated use OpsSeoScore from ops-score */
export type OpsSeoScoreBreakdown = {
  searchConsole: number | null;
  ga4: number | null;
  indexRate: number | null;
  sitemap: number | null;
  internalLinks: number | null;
  structuredData: number | null;
};

export type { OpsSeoScore };

export type OpsSuggestionPriority = 3 | 4 | 5;

export type OpsSuggestion = {
  id: string;
  text: string;
  priority: OpsSuggestionPriority;
  stars: string;
};

export type OpsTaskBucket = "urgent" | "this_week" | "backlog";

export type OpsTask = {
  id: string;
  text: string;
  bucket: OpsTaskBucket;
  completed: boolean;
};

export type OpsAlertSeverity = "critical" | "warning" | "success" | "info";

export type OpsAlert = {
  id: string;
  title: string;
  detail: string;
  severity: OpsAlertSeverity;
};

export type OpsTopStats = {
  catalog: Pick<
    AdminSiteStats,
    "works" | "actresses" | "makers" | "labels" | "series" | "genres"
  >;
  indexedPages: number | null;
  notIndexedPages: number | null;
  indexRate: number | null;
  indexEstimated: boolean;
  indexableUrlCount: number | null;
  updatedAt: string | null;
};

export type OpsDashboardPayload = {
  version: 3;
  generatedAt: string;
  top: OpsTopStats;
  analyticsKpis: OpsAnalyticsKpis;
  seoScore: OpsSeoScore;
  suggestions: OpsSuggestion[];
  tasks: OpsTask[];
  alerts: OpsAlert[];
  sitemapSummary: GscSitemapSummary;
  internalLinkAudit: InternalLinkAuditResult | null;
  structuredDataAudit: StructuredDataAuditResult | null;
  seo: SeoCachePayload;
  ga4: Ga4CachePayload;
  dmm: DmmAffiliateCachePayload;
};
