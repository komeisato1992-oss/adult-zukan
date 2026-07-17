import Link from "next/link";
import { CompareSimilarWorksCarousel } from "@/components/compare/CompareSimilarWorksCarousel";
import { getSimilarWorks } from "@/lib/compare/get-similar-works";
import type { BothSimilarWorkCard } from "@/lib/compare/types";

type CompareSingleWorkSuggestionsProps = {
  contentId: string;
  title?: string;
  excludeIds?: string[];
};

export async function CompareSingleWorkSuggestions({
  contentId,
  excludeIds = [contentId],
}: CompareSingleWorkSuggestionsProps) {
  const similar = await getSimilarWorks(contentId, "overall");
  const works: BothSimilarWorkCard[] = similar
    .filter((work) => !excludeIds.includes(work.contentId))
    .slice(0, 12)
    .map((work) => ({
      ...work,
      scoreA: work.similarityScore,
      scoreB: 0,
      bothScore: work.similarityScore,
      source: "a",
    }));

  if (works.length === 0) {
    return (
      <section className="mt-10 rounded border border-border bg-surface p-6 text-center">
        <h2 className="text-base font-bold text-foreground">
          比較する作品をもう1つ選んでください
        </h2>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/compare/select/${encodeURIComponent(contentId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
          >
            似ている作品から選ぶ
          </Link>
          <Link
            href="/works"
            className="inline-flex min-h-11 items-center justify-center rounded border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-light"
          >
            作品一覧から探す
          </Link>
        </div>
      </section>
    );
  }

  return (
    <CompareSimilarWorksCarousel
      works={works}
      excludeIds={excludeIds}
      source="a"
      worksHref="/works"
      worksLabel="作品一覧から探す"
    />
  );
}
