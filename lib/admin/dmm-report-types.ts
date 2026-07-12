/** dmm_reports テーブル相当の1行 */
export type DmmReportRow = {
  id: string;
  date: string;
  clicks: number;
  sales: number;
  reward: number;
  category_reward: number;
  direct_reward: number;
  conversion_rate: number;
  cpc: number;
  cpa: number;
  created_at: string;
  updated_at: string;
};

export type DmmEntityKind = "work" | "genre" | "actress" | "maker";

/** 任意: 作品/ジャンル等の内訳（AI分析用） */
export type DmmEntityStat = {
  kind: DmmEntityKind;
  key: string;
  name: string;
  clicks: number;
  sales: number;
  reward: number;
  conversion_rate: number;
};

export type DmmReportsDocument = {
  version: 1;
  updatedAt: string | null;
  importedAt: string | null;
  source: "json" | "csv" | "env" | "url" | null;
  fileName: string | null;
  rows: DmmReportRow[];
  entities: DmmEntityStat[];
};

export type DmmAffiliatePeriod =
  | "today"
  | "yesterday"
  | "7d"
  | "28d"
  | "90d";

export type DmmAffiliateMetrics = {
  clicks: number;
  conversions: number;
  conversionRate: number;
  reward: number;
  categoryReward: number;
  directReward: number;
  clickUnitPrice: number;
  conversionUnitPrice: number;
};

export type DmmAffiliateDailyPoint = {
  date: string;
  clicks: number;
  conversions: number;
  reward: number;
  categoryReward: number;
  directReward: number;
};

export type DmmAiInsights = {
  highConversionWorks: DmmEntityStat[];
  lowConversionWorks: DmmEntityStat[];
  topRewardGenres: DmmEntityStat[];
  topRewardActresses: DmmEntityStat[];
  topRewardMakers: DmmEntityStat[];
};

export type DmmAffiliateCachePayload = {
  version: 3;
  updatedAt: string | null;
  importedAt: string | null;
  lastSuccessfulAt: string | null;
  configured: boolean;
  configMessage?: string;
  connectionStatus: "connected" | "error" | "unconfigured" | "stale";
  fetchError?: string;
  rowCount: number;
  dateRange: { start: string | null; end: string | null };
  source: DmmReportsDocument["source"];
  fileName: string | null;
  periods: Record<DmmAffiliatePeriod, DmmAffiliateMetrics>;
  daily: DmmAffiliateDailyPoint[];
  insights: DmmAiInsights;
  rankings: {
    works: DmmEntityStat[];
    actresses: DmmEntityStat[];
  };
};

export type DmmImportResult = {
  success: true;
  inserted: number;
  updated: number;
  total: number;
  dateRange: { start: string | null; end: string | null };
  updatedAt: string;
};
