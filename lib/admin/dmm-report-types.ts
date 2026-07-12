/** カテゴリ / ダイレクト日次成果の1行 */
export type DmmRewardType = "category" | "direct";

export type DmmRewardRow = {
  date: string;
  type: DmmRewardType;
  /** 販売金額 */
  sales: number;
  /** 報酬額 */
  reward: number;
  /** 報酬件数（成果件数） */
  count: number;
};

export type DmmReportsDocument = {
  version: 2;
  updatedAt: string | null;
  importedAt: string | null;
  source: "csv" | null;
  fileName: string | null;
  rows: DmmRewardRow[];
};

export type DmmAffiliatePeriod = "today" | "7d" | "28d" | "365d";

export type DmmAffiliateMetrics = {
  /** 総報酬 */
  reward: number;
  /** 成果件数 */
  count: number;
  /** 販売金額 */
  sales: number;
  /** 平均報酬（reward / count） */
  avgReward: number;
  categoryReward: number;
  directReward: number;
  categoryCount: number;
  directCount: number;
  categorySales: number;
  directSales: number;
};

export type DmmAffiliateDailyPoint = {
  date: string;
  categoryReward: number;
  directReward: number;
  reward: number;
  categoryCount: number;
  directCount: number;
  categorySales: number;
  directSales: number;
  count: number;
  sales: number;
};

export type DmmTypeBreakdownRow = {
  type: DmmRewardType;
  label: string;
  count: number;
  sales: number;
  reward: number;
  avgReward: number;
};

export type DmmAffiliateCachePayload = {
  version: 4;
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
  /** 互換用（空） */
  insights: {
    highConversionWorks: [];
    lowConversionWorks: [];
    topRewardGenres: [];
    topRewardActresses: [];
    topRewardMakers: [];
  };
  rankings: {
    works: [];
    actresses: [];
  };
};

export type DmmImportResult = {
  success: true;
  inserted: number;
  updated: number;
  total: number;
  type: DmmRewardType;
  dateRange: { start: string | null; end: string | null };
  updatedAt: string;
};

/** @deprecated */
export type DmmReportRow = DmmRewardRow;
