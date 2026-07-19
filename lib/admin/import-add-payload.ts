import type { FetchedImportCandidate } from "@/lib/admin/import-simple-types";
import { getCandidateSelectionId } from "@/lib/admin/import-session-storage";
import type { DmmItem } from "@/lib/dmm/types";
import { pickPackageImageCandidate } from "@/lib/works/package-image";

/** 追加APIへ送る最小限の作品データ（巨大なサンプル配列等を除外） */
export function slimWorkItemForAdd(item: DmmItem): DmmItem {
  return {
    content_id: item.content_id,
    product_id: item.product_id,
    title: item.title,
    URL: item.URL,
    affiliateURL: item.affiliateURL,
    imageURL: item.imageURL,
    prices: item.prices,
    iteminfo: item.iteminfo,
    date: item.date,
    volume: item.volume,
    description: item.description,
    maker: item.maker,
    label: item.label,
    series: item.series,
    review: item.review,
    sourcePopularityRank: item.sourcePopularityRank,
    popularityUpdatedAt: item.popularityUpdatedAt,
    fanzaNewRank: item.fanzaNewRank,
    fanzaNewRankUpdatedAt: item.fanzaNewRankUpdatedAt,
    addedAt: item.addedAt,
  };
}

export function buildAddSelectedWorksPayload(
  candidates: FetchedImportCandidate[],
): {
  works: Array<{
    contentId: string;
    item: DmmItem;
    sourcePopularityRank: number | null;
    fanzaNewRank: number | null;
    imageStatus: string | null;
    imageStatusCheckedAt: string | null;
    packageImage: string | null;
  }>;
} {
  return {
    works: candidates.map((candidate) => {
      const position =
        candidate.candidateMeta?.absolutePopularityPosition ??
        candidate.rankPosition ??
        null;
      const isNewSort = candidate.candidateMeta?.sourceSort === "new";
      return {
        contentId: getCandidateSelectionId(candidate),
        item: slimWorkItemForAdd(candidate.item),
        // 人気順取得時のみ popularity。新着順の位置は fanzaNewRank へ。
        sourcePopularityRank: isNewSort ? null : position,
        fanzaNewRank: isNewSort ? position : null,
        imageStatus: candidate.imageStatus ?? null,
        imageStatusCheckedAt: candidate.imageStatusCheckedAt ?? null,
        packageImage:
          candidate.packageImage !== undefined
            ? candidate.packageImage
            : pickPackageImageCandidate(candidate.item),
      };
    }),
  };
}
