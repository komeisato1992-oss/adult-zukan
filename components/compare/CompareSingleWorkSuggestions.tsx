import Link from "next/link";
import { CompareRelatedWorkCard } from "@/components/compare/CompareRelatedWorkCard";
import { getSimilarWorks } from "@/lib/compare/get-similar-works";
import type { BothSimilarWorkCard } from "@/lib/compare/types";
import { COMPARE_RELATED_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type CompareSingleWorkSuggestionsProps = {
  contentId: string;
  title?: string;
};

export async function CompareSingleWorkSuggestions({
  contentId,
  title,
}: CompareSingleWorkSuggestionsProps) {
  const similar = await getSimilarWorks(contentId, "overall");
  const works: BothSimilarWorkCard[] = similar.slice(0, 8).map((work) => ({
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
            作品一覧から選ぶ
          </Link>
        </div>
      </section>
    );
  }

  const headingTitle =
    title && title.length > 24 ? `${title.slice(0, 24)}…` : title;

  return (
    <section className="mt-12 border-t border-border pt-8 max-[768px]:mt-8">
      <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
        {headingTitle
          ? `「${headingTitle}」に似ている作品`
          : "似ている作品から比較相手を選ぶ"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        「比較＋」で2作品目以降を追加できます（最大4作品）
      </p>
      <div className={`mt-4 ${COMPARE_RELATED_GRID_CLASSNAME}`}>
        {works.map((work) => (
          <CompareRelatedWorkCard
            key={work.contentId}
            work={work}
            source="a"
          />
        ))}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link
          href={`/compare/select/${encodeURIComponent(contentId)}`}
          className="text-accent hover:underline"
        >
          もっと似ている作品を見る
        </Link>
      </p>
    </section>
  );
}
