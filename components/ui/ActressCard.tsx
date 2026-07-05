import Link from "next/link";
import { PersonImagePlaceholder } from "@/components/ui/PersonImagePlaceholder";
import type { Actress } from "@/data/types";

type ActressCardProps = {
  actress: Actress;
  rank?: number;
  workCount?: number;
};

export function ActressCard({ actress, rank, workCount = 0 }: ActressCardProps) {
  return (
    <article className="group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
      <Link href={`/actresses/${actress.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden">
          {rank !== undefined && (
            <span className="absolute left-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {rank}
            </span>
          )}
          <PersonImagePlaceholder name={actress.name} className="h-full" />
        </div>
        <div className="p-3">
          <h3 className="text-sm font-semibold text-foreground">{actress.name}</h3>
          <p className="mt-1 text-xs text-muted">出演作品 {workCount}件</p>
        </div>
      </Link>
    </article>
  );
}
