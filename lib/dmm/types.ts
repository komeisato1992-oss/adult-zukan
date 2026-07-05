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

export type DmmPrices = {
  price?: string;
  list_price?: string;
};

export type DmmItemInfo = {
  genre?: DmmGenre[];
  actress?: DmmActress[];
  maker?: DmmMaker[];
};

export type DmmItem = {
  content_id: string;
  product_id: string;
  title: string;
  URL: string;
  affiliateURL: string;
  imageURL?: DmmImageUrl;
  date?: string;
  prices?: DmmPrices;
  iteminfo?: DmmItemInfo;
  review?: {
    count?: number;
    average?: string;
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
};
