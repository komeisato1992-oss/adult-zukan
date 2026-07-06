import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { RankedNameCount } from "@/lib/works/catalog";

type DmmMakerRankingSectionProps = {
  makers: RankedNameCount[];
  id?: string;
};

export function DmmMakerRankingSection({
  makers,
  id = "popular-makers",
}: DmmMakerRankingSectionProps) {
  if (makers.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="人気メーカー" href="/makers" id={id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {makers.map((maker, index) => (
          <Link
            key={maker.slug}
            href={`/makers/${maker.slug}`}
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
    </section>
  );
}
