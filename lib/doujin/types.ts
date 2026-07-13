export type DoujinEntityRef = {
  externalId?: string;
  name: string;
  ruby?: string;
};

export type DoujinStoredCircle = {
  id: string;
  externalId?: string;
  name: string;
  ruby?: string;
  createdAt: string;
  updatedAt: string;
};

export type DoujinStoredAuthor = {
  id: string;
  externalId?: string;
  name: string;
  ruby?: string;
  /** 正規化名（空白・NFKC）。重複判定用。無い場合は name から計算 */
  normalizedName?: string;
  createdAt: string;
  updatedAt: string;
};

export type DoujinStoredSeries = {
  id: string;
  externalId?: string;
  name: string;
  ruby?: string;
  createdAt: string;
  updatedAt: string;
};

export type DoujinStoredGenre = {
  id: string;
  externalId?: string;
  name: string;
  ruby?: string;
  createdAt: string;
  updatedAt: string;
};

export type DoujinImportSource =
  | "POPULAR"
  | "NEW"
  | "POPULAR_AND_NEW"
  | "MANUAL";

export type DoujinStoredWork = {
  id: string;
  externalProductId: string;
  contentId: string;
  title: string;
  titleNormalized: string;
  description?: string;
  affiliateUrl?: string;
  productUrl?: string;
  imageSmallUrl?: string;
  imageListUrl?: string;
  imageLargeUrl?: string;
  sampleImageUrls: string[];
  price: number | null;
  originalPrice: number | null;
  discountRate: number | null;
  isSale: boolean;
  saleEndAt: string | null;
  releaseDate?: string;
  rating: number | null;
  reviewCount: number | null;
  productFormat?: string;
  /** 正規化済み作品形式（comic / cg / video 等）。不明時は未設定 */
  productFormatNormalized?: string;
  volume?: string;
  pageCount?: number | null;
  siteCode: string;
  serviceCode: string;
  floorCode: string;
  circleIds: string[];
  authorIds: string[];
  seriesId?: string;
  genreIds: string[];
  /** 秘密情報を除去した商品単位の元JSON */
  rawApiResponse?: Record<string, unknown>;
  isPublished: boolean;
  /** API人気順取得時の順位（互換） */
  sourcePopularityRank?: number;
  /** 初期導入時の人気順位（永続ランキングではない） */
  initialPopularRank?: number;
  popularImportRank?: number;
  popularImportedAt?: string;
  /** 定期更新用の現在人気順位（未実装時は空） */
  currentPopularRank?: number;
  rankUpdatedAt?: string;
  newImportRank?: number;
  newImportedAt?: string;
  importSource?: DoujinImportSource;
  createdAt: string;
  updatedAt: string;
  lastFetchedAt: string;
};

export type DoujinImportJobType =
  | "POPULAR_INITIAL_IMPORT"
  | "NEW_INITIAL_IMPORT";

export type DoujinImportJobStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DoujinImportJob = {
  id: string;
  jobType: DoujinImportJobType;
  status: DoujinImportJobStatus;
  targetUniqueCount: number;
  /** 人気順: 対象ユニーク件数 / 新着: 純増件数 */
  currentUniqueCount: number;
  apiFetchedCount: number;
  apiSearchTotalCount?: number;
  validItemCount: number;
  newCreatedCount: number;
  updatedCount: number;
  duplicateCount: number;
  popularOverlapCount: number;
  existingDbDuplicateCount: number;
  skippedCount: number;
  errorCount: number;
  currentOffset: number;
  nextOffset: number;
  batchSize: number;
  sort: string;
  requestDelayMs: number;
  maxRetries: number;
  consecutiveEmptyNewBatches: number;
  consecutiveErrors: number;
  maxEmptyNewBatches: number;
  batchesProcessed: number;
  maxBatches: number;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  lastProcessedAt?: string;
  lastError?: string;
  stopReason?: string;
  stopRequested?: boolean;
  pauseRequested?: boolean;
  dryRun?: boolean;
  site: string;
  service: string;
  floor: string;
  /** このジョブでユニークカウント済みの workId */
  countedWorkIds: string[];
  metadata?: Record<string, unknown>;
};

/** 画面表示用（公開APIでは raw を含めない） */
export type DoujinWork = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageListUrl?: string;
  imageLargeUrl?: string;
  sampleImageUrls?: string[];
  affiliateUrl?: string;
  circleId?: string;
  circleName?: string;
  /** 複数サークル対応（id/name は同じインデックス） */
  circleIds?: string[];
  circleNames?: string[];
  authorIds?: string[];
  authorNames?: string[];
  seriesId?: string;
  seriesName?: string;
  genreIds?: string[];
  genreNames?: string[];
  price?: number;
  originalPrice?: number;
  isSale?: boolean;
  saleEndAt?: string;
  releaseDate?: string;
  rating?: number;
  reviewCount?: number;
  productFormat?: string;
  /** comic / cg / video / audio / game / voice_comic / novel / other */
  productFormatNormalized?: string;
  discountRate?: number;
  contentId?: string;
  pageCount?: number;
  volume?: string;
  siteCode?: string;
  updatedAt?: string;
  initialPopularRank?: number;
  currentPopularRank?: number;
  newImportRank?: number;
};

export type DoujinGenre = {
  id: string;
  name: string;
  workCount: number;
};

export type DoujinNavItem = {
  href: string;
  label: string;
};

export type NormalizedDoujinApiItem = {
  externalProductId: string;
  contentId: string;
  title: string;
  titleNormalized: string;
  description?: string;
  affiliateUrl?: string;
  productUrl?: string;
  images: {
    small?: string;
    list?: string;
    large?: string;
  };
  sampleImages: string[];
  price: number | null;
  originalPrice: number | null;
  discountRate: number | null;
  isSale: boolean;
  saleEndAt: string | null;
  releaseDate?: string;
  rating: number | null;
  reviewCount: number | null;
  circles: DoujinEntityRef[];
  authors: DoujinEntityRef[];
  series: DoujinEntityRef[];
  genres: DoujinEntityRef[];
  productFormat?: string;
  volume?: string;
  pageCount?: number | null;
  siteCode: string;
  serviceCode: string;
  floorCode: string;
  rawApiResponse: Record<string, unknown>;
};

export type DoujinFetchJob = {
  id: string;
  status: "idle" | "running" | "completed" | "stopped" | "error";
  requestedHits: number;
  offset: number;
  keyword?: string;
  sort?: string;
  site: string;
  service: string;
  floor: string;
  searchTotalCount?: number;
  apiReturnedCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  nextOffset?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  lastError?: string;
  stopRequested?: boolean;
};

export type DoujinFetchLogEntry = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  message: string;
  jobId?: string;
  contentId?: string;
  detail?: Record<string, unknown>;
};

export type DoujinCatalogStats = {
  workCount: number;
  circleCount: number;
  authorCount: number;
  seriesCount: number;
  genreCount: number;
  lastFetchedAt: string | null;
  errorCount: number;
};

export type DoujinSyncJobStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DoujinSyncJob = {
  id: string;
  mode: "light" | "full";
  status: DoujinSyncJobStatus;
  sort: string;
  batchSize: number;
  currentOffset: number;
  nextOffset: number;
  targetCount?: number;
  apiFetchedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  batchesProcessed: number;
  maxBatches: number;
  estimatedJsonSaves: number;
  rawShardsTouched: string[];
  changedFields: string[];
  dryRun?: boolean;
  site: string;
  service: string;
  floor: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  lastError?: string;
  stopReason?: string;
  stopRequested?: boolean;
  pauseRequested?: boolean;
};

