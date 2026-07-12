import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RankingEmptyState } from "@/components/ranking/RankingList";
import { getPopularSeries } from "@/lib/ranking/entity-ranking-service";

type SeriesRankingSectionProps = {
  id?: string;
  limit?: number;
};

export async function SeriesRankingSection({
  id = "popular-series",
  limit = 8,
}: SeriesRankingSectionProps) {
  const result = await getPopularSeries(limit);
  const ranked = result.items;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="人気シリーズ" href="/ranking/series" id={id} />
      {result.error ? (
        <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
      ) : ranked.length === 0 ? (
        <RankingEmptyState message="ランキングデータを集計中です" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ranked.map((series, index) => (
            <Link
              key={series.slug}
              href={series.href}
              className="group flex items-center gap-3 rounded-lg border border-border/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent">
                  {series.name}
                </p>
                <p className="text-xs text-muted">{series.workCount}作品</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
