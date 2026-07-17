import { CompareSimilarWorksCarousel } from "@/components/compare/CompareSimilarWorksCarousel";
import {
  getCompareRelatedWorks,
  type BothSimilarWorkCard,
} from "@/lib/compare/get-similar-works";
import type { SimilarWorkCardData } from "@/lib/compare/types";

type CompareRelatedWorksSectionProps = {
  contentIdA: string;
  contentIdB: string;
  titleA?: string;
  titleB?: string;
  /** 現在比較中の全ID（候補から除外） */
  excludeIds?: string[];
};

function mergeRelatedWorks(input: {
  both: BothSimilarWorkCard[];
  forA: BothSimilarWorkCard[];
  forB: BothSimilarWorkCard[];
}): SimilarWorkCardData[] {
  const seen = new Set<string>();
  const merged: SimilarWorkCardData[] = [];

  for (const list of [input.both, input.forA, input.forB]) {
    for (const work of list) {
      if (seen.has(work.contentId)) continue;
      seen.add(work.contentId);
      merged.push(work);
    }
  }

  return merged;
}

export async function CompareRelatedWorksSection({
  contentIdA,
  contentIdB,
  excludeIds = [contentIdA, contentIdB],
}: CompareRelatedWorksSectionProps) {
  const related = await getCompareRelatedWorks(contentIdA, contentIdB, 8);
  const works = mergeRelatedWorks(related).filter(
    (work) => !excludeIds.includes(work.contentId),
  );

  if (works.length === 0) {
    return null;
  }

  return (
    <CompareSimilarWorksCarousel
      works={works}
      excludeIds={excludeIds}
      source="both"
      worksHref="/works"
      worksLabel="作品一覧から探す"
    />
  );
}
