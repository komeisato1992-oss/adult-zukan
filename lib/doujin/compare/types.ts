export type DoujinSimilarWorkCardData = {
  workId: string;
  title: string;
  imageUrl: string;
  circleName?: string;
  authorNames: string[];
  genreNames: string[];
  productFormat?: string;
  price?: number;
  similarityScore: number;
  reasonLabels: string[];
};

export type DoujinBothSimilarWorkCard = DoujinSimilarWorkCardData & {
  averageScore: number;
  scoreA: number;
  scoreB: number;
};

export function formatDoujinComparePriceYen(price?: number | null): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `¥${Math.round(price).toLocaleString("ja-JP")}`;
}
