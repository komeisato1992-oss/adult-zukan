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
  sort?: "rank" | "date" | "price" | "review";
  keyword?: string;
  cid?: string;
  cache?: RequestCache;
  revalidate?: number;
};
