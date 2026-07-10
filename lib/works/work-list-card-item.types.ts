export type WorkListCardItem = {
  contentId: string;
  title: string;
  imageUrl: string;
  actressNames: string[];
  displayPrice?: string;
  originalPrice?: string;
  isOnSale: boolean;
  saleInfo?: {
    regularPrice: number;
    currentPrice: number;
    discountRate: number;
  };
  releaseDate?: string;
  fanzaUrl: string;
};

export type WorkListCardPriceDisplayMode = "default" | "sale";
