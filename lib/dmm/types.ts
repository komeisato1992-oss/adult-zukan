export type DmmGenre = {
  id: number;
  name: string;
};

export type DmmActress = {
  id: number;
  name: string;
  ruby?: string;
};

export type DmmMaker = {
  id: number;
  name: string;
};

export type DmmImageUrl = {
  list?: string;
  small?: string;
  large?: string;
};

export type DmmDelivery = {
  type: string;
  price: string;
  list_price?: string;
};

export type DmmPrices = {
  price?: string;
  list_price?: string;
  deliveries?: {
    delivery?: DmmDelivery[];
  };
};

export type DmmCampaign = {
  date_begin: string;
  date_end: string;
  title: string;
};

export type DmmLabel = {
  id: number;
  name: string;
};

export type DmmSeries = {
  id: number;
  name: string;
};

export type DmmSampleImageSet = {
  image?: string[];
};

export type DmmSampleImageUrl = {
  sample?: DmmSampleImageSet;
  sample_s?: DmmSampleImageSet;
  sample_l?: DmmSampleImageSet;
  sampleImageComment?: string;
};

export type DmmSampleMovieUrl = {
  size_720_480?: string;
  size_644_414?: string;
  size_560_360?: string;
  size_476_306?: string;
  pc_flag?: number;
  sp_flag?: number;
};

export type DmmItemInfo = {
  genre?: DmmGenre[];
  actress?: DmmActress[];
  maker?: DmmMaker[];
  label?: DmmLabel[];
  series?: DmmSeries[];
};

export type DmmItem = {
  content_id: string;
  product_id: string;
  title: string;
  /** FANZA商品説明（スナップショット保存用） */
  description?: string;
  /** DMM Affiliate API の comment フィールド */
  comment?: string;
  URL: string;
  affiliateURL: string;
  imageURL?: DmmImageUrl;
  sampleImageURL?: DmmSampleImageUrl;
  sampleMovieURL?: DmmSampleMovieUrl;
  date?: string;
  volume?: string;
  prices?: DmmPrices;
  iteminfo?: DmmItemInfo;
  maker?: DmmMaker[];
  label?: DmmLabel[];
  series?: DmmSeries[];
  actress?: DmmActress[];
  review?: {
    count?: number;
    average?: string;
  };
  /** FANZA人気順取得時の順位（1位が最も人気） */
  sourcePopularityRank?: number;
  /** sourcePopularityRank の最終更新日時 */
  popularityUpdatedAt?: string;
  /** サイトカタログへ追加した日時 */
  addedAt?: string;
  /** DMM API の campaign（セール期間等） */
  campaign?: DmmCampaign[];
  /** カタログへ取り込んだ日時 */
  importedAt?: string;
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
  /** サイト上に表示するか（false = 非表示） */
  isActive?: boolean;
  /** セール状態: on_sale / normal / unknown */
  saleStatus?: "on_sale" | "normal" | "unknown";
  /** 現在のセール価格（数値・円） */
  salePrice?: number | null;
  /** 通常価格（数値・円） */
  regularPrice?: number | null;
  /** 割引率（%） */
  discountRate?: number | null;
  /** セール終了日時（API campaign から取得可能な場合のみ） */
  saleEndAt?: string | null;
  /** 販売状態 */
  availabilityStatus?: "available" | "temporarily_unconfirmed" | "unavailable";
  /** FANZA との最終同期成功日時 */
  lastSyncedAt?: string;
  /** 最終同期試行日時 */
  lastSyncAttemptAt?: string;
  /** FANZA側で連続して確認できなかった回数 */
  consecutiveNotFoundCount?: number;
  /** 販売終了の可能性を最初に検知した日時 */
  unavailableDetectedAt?: string;
  /** 最後の同期エラー */
  syncErrorMessage?: string | null;
  /** 非表示理由 */
  hiddenReason?: "fanza_unavailable" | "manual" | null;
};

export type DmmTestApiResponse = {
  result: {
    status: number | string;
    result_count?: number;
    total_count?: number;
    items: DmmItem[];
  };
};

export type DmmItemListResponse = {
  result: {
    status: string;
    result_count: number;
    total_count: number;
    items: DmmItem[];
  };
};

export type DmmFetchOptions = {
  hits?: number;
  offset?: number;
  sort?: "rank" | "date" | "price" | "review" | "-price" | "match";
  keyword?: string;
  cid?: string;
  /** 未指定時は FANZA（既存AV互換） */
  site?: string;
  /** 未指定時は digital（既存AV互換） */
  service?: string;
  /** 未指定時は videoa（既存AV互換） */
  floor?: string;
  cache?: RequestCache;
  revalidate?: number;
};
