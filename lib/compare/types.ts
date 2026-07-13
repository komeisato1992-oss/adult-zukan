import type { SimilarityReason } from "@/lib/compare/similarity";
import { formatDmmPriceString } from "@/lib/dmm/format-price";

export type SimilarWorkCardData = {
  contentId: string;
  title: string;
  imageUrl?: string;
  actressNames: string[];
  makerName?: string;
  labelName?: string;
  price?: string;
  currentPrice?: number | null;
  regularPrice?: number | null;
  discountRate?: number | null;
  priceDiffYen?: number | null;
  rating?: string;
  releaseDate?: string;
  similarityScore: number;
  reasons: SimilarityReason[];
  fanzaUrl: string;
};

export type BothSimilarWorkCard = SimilarWorkCardData & {
  scoreA: number;
  scoreB: number;
  bothScore: number;
  source: "both" | "a" | "b";
};

export function formatPriceYen(
  value: number | null | undefined,
): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return formatDmmPriceString(String(value));
}
