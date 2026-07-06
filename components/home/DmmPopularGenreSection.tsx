import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { RankedNameCount } from "@/lib/works/catalog";

type DmmPopularGenreSectionProps = {
  genres: RankedNameCount[];
  id?: string;
};

export function DmmPopularGenreSection({
  genres,
  id = "popular-genres",
}: DmmPopularGenreSectionProps) {
  if (genres.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="人気ジャンル" href="/genres" id={id} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {genres.map((genre) => (
          <Link
            key={genre.slug}
            href={`/genres/${genre.slug}`}
            className="group rounded-lg border border-border/80 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
          >
            <span className="text-sm font-semibold text-foreground group-hover:text-accent">
              {genre.name}
            </span>
            <span className="mt-1.5 block text-xs text-muted">
              {genre.workCount}作品
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
