import type { DmmItem } from "@/lib/dmm/types";

/** DMM API の campaign フィールド（catalog 実データに存在） */
export type DmmCampaign = {
  date_begin: string;
  date_end: string;
  title: string;
};

/** サイト側で保持する作品更新メタデータ */
export type CatalogWorkRefreshMeta = {
  /** 最後に API から再取得して反映した日時 */
  lastRefreshedAt?: string;
  /** 価格が変わった最終日時 */
  priceUpdatedAt?: string;
  /** セール状態が変わった最終日時 */
  saleUpdatedAt?: string;
  /** 取得不可を確認した日時 */
  unavailableCheckedAt?: string;
  /** 連続取得失敗回数 */
  consecutiveFetchFailures?: number;
  /** 販売状態（サイト管理） */
  availability?: "available" | "unavailable";
  /** サイト側の最終更新日時 */
  updatedAt?: string;
  /** カタログへ取り込んだ日時（レガシー互換） */
  importedAt?: string;
};

export type CatalogRefreshState = {
  nextRefreshOffset: number;
  batchSize: number;
  lastCompletedAt: string | null;
  cycleCount: number;
  lastBatchSummary: CatalogRefreshBatchSummary | null;
};

export type CatalogRefreshBatchSummary = {
  targetCount: number;
  updatedCount: number;
  unchangedCount: number;
  unavailableCount: number;
  failedCount: number;
  priceChangedCount: number;
  saleStartedCount: number;
  saleEndedCount: number;
  availabilityChangedCount: number;
  nextRefreshOffset: number;
  cycleCount: number;
  elapsedMs: number;
  failures: Array<{ contentId: string; reason: string }>;
};

export type CatalogRefreshStrategy = {
  prioritizeSale: boolean;
  prioritizeStale: boolean;
  prioritizePopular: boolean;
};

export type RefreshableWorkSnapshot = Pick<
  DmmItem,
  | "content_id"
  | "prices"
  | "URL"
  | "affiliateURL"
  | "imageURL"
  | "sampleImageURL"
  | "sampleMovieURL"
  | "iteminfo"
  | "date"
  | "volume"
  | "review"
  | "campaign"
  | "maker"
  | "label"
  | "series"
  | "actress"
>;

export type CatalogRefreshWorkResult =
  | {
      status: "updated";
      contentId: string;
      priceChanged: boolean;
      saleStarted: boolean;
      saleEnded: boolean;
      availabilityChanged: boolean;
    }
  | {
      status: "unchanged";
      contentId: string;
    }
  | {
      status: "unavailable";
      contentId: string;
      reason: string;
    }
  | {
      status: "failed";
      contentId: string;
      reason: string;
    };
