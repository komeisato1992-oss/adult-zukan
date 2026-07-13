import Link from "next/link";
import { DoujinCompareRelatedWorkCard } from "@/components/doujin/DoujinCompareRelatedWorkCard";
import { getDoujinSimilarWorks } from "@/lib/doujin/compare/get-similar-works";

type DoujinCompareSingleWorkSuggestionsProps = {
  workId: string;
  title?: string;
};

export async function DoujinCompareSingleWorkSuggestions({
  workId,
  title,
}: DoujinCompareSingleWorkSuggestionsProps) {
  const similar = await getDoujinSimilarWorks(workId, "overall");
  const works = similar.slice(0, 8);

  if (works.length === 0) {
    return (
      <section className="mt-10 rounded border border-border bg-surface p-6 text-center">
        <h2 className="text-base font-bold text-foreground">
          比較する作品をもう1つ選んでください
        </h2>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/doujin/compare/select/${encodeURIComponent(workId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
          >
            似ている作品から選ぶ
          </Link>
          <Link
            href="/doujin/works"
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
          : "この作品に似ている作品"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        「比較＋」で2作品目以降を追加できます（最大4作品）
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 min-[769px]:grid-cols-3 min-[1100px]:grid-cols-4 min-[1400px]:grid-cols-5">
        {works.map((work) => (
          <DoujinCompareRelatedWorkCard
            key={work.workId}
            work={work}
            source="a"
          />
        ))}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link
          href={`/doujin/compare/select/${encodeURIComponent(workId)}`}
          className="text-accent hover:underline"
        >
          もっと似ている作品を見る
        </Link>
      </p>
    </section>
  );
}
