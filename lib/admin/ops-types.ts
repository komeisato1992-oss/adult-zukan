import type { AdminSiteStats } from "@/lib/admin/stats";
import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-affiliate-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";

export type OpsGscPeriod = "1" | "7" | "28" | "90";
export type OpsDmmPeriod = "today" | "yesterday" | "7d" | "28d";
export type OpsGa4Period = 1 | 7 | 28 | 90;

export type OpsSeoScoreBreakdown = {
  searchConsole: number;
  ga4: number;
  indexRate: number;
  sitemap: number;
  internalLinks: number;
  structuredData: number;
};

export type OpsSeoScore = {
  total: number;
  breakdown: OpsSeoScoreBreakdown;
};

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

export type OpsAlertSeverity = "critical" | "warning";

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
  updatedAt: string | null;
};

export type OpsDashboardPayload = {
  version: 1;
  generatedAt: string;
  top: OpsTopStats;
  seoScore: OpsSeoScore;
  suggestions: OpsSuggestion[];
  tasks: OpsTask[];
  alerts: OpsAlert[];
  seo: SeoCachePayload;
  ga4: Ga4CachePayload;
  dmm: DmmAffiliateCachePayload;
};
