import { getDoujinCardImage } from "@/lib/doujin/card-image";
import type { DoujinWork } from "@/lib/doujin/types";

export type DoujinRepresentativeWork = {
  id: string;
  title: string;
  imageUrl: string;
  releaseDate?: string;
  rating?: number;
  reviewCount?: number;
};

/**
 * 作者の代表作品を選定する。
 * 優先: reviewCount → rating → releaseDate新しい → 画像あり
 * （販売数は未取得のため使わない）
 * 画像のない作品は候補から除外。
 */
export function getRepresentativeWorkForAuthor(
  works: DoujinWork[],
): DoujinRepresentativeWork | null {
  const withImage = works
    .map((work) => {
      const imageUrl = getDoujinCardImage(work);
      if (!imageUrl || imageUrl.includes("placeholder")) return null;
      return { work, imageUrl };
    })
    .filter((row): row is { work: DoujinWork; imageUrl: string } =>
      Boolean(row),
    );

  if (withImage.length === 0) return null;

  const sorted = [...withImage].sort((a, b) => {
    const reviewDiff =
      (b.work.reviewCount ?? 0) - (a.work.reviewCount ?? 0);
    if (reviewDiff !== 0) return reviewDiff;

    const ratingDiff = (b.work.rating ?? 0) - (a.work.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;

    return String(b.work.releaseDate ?? "").localeCompare(
      String(a.work.releaseDate ?? ""),
    );
  });

  const best = sorted[0];
  return {
    id: best.work.id,
    title: best.work.title,
    imageUrl: best.imageUrl,
    releaseDate: best.work.releaseDate,
    rating: best.work.rating,
    reviewCount: best.work.reviewCount,
  };
}
