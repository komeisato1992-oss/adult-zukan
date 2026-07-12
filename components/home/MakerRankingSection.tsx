import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RankingEmptyState } from "@/components/ranking/RankingList";
import { getPopularMakers } from "@/lib/ranking/entity-ranking-service";

type MakerRankingSectionProps = {
  id?: string;
  limit?: number;
};

export async function MakerRankingSection({
  id = "popular-makers",
  limit = 8,
}: MakerRankingSectionProps) {
  const result = await getPopularMakers(limit);
  const ranked = result.items;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="人気メーカー" href="/ranking/makers" id={id} />
      {result.error ? (
        <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
      ) : ranked.length === 0 ? (
        <RankingEmptyState message="ランキングデータを集計中です" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ranked.map((maker, index) => (
            <Link
              key={maker.slug}
              href={maker.href}
              className="group rounded-lg border border-border/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-accent">
                    {maker.name}
                  </p>
                  <p className="text-xs text-muted">{maker.workCount}作品</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
