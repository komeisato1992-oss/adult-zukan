import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllGenres } from "@/data/genres";
import { getAllWorks } from "@/lib/works/repository";

type PopularGenreSectionProps = {
  id?: string;
  limit?: number;
};

export async function PopularGenreSection({
  id = "popular-genres",
  limit = 8,
}: PopularGenreSectionProps) {
  const genres = getAllGenres();
  const allWorks = await getAllWorks();

  const ranked = genres
    .map((genre) => ({
      genre,
      workCount: allWorks.filter(
        (work) =>
          work.genreSlugs.includes(genre.slug) ||
          work.genreNames.includes(genre.name),
      ).length,
    }))
    .sort((a, b) => b.workCount - a.workCount)
    .slice(0, limit);

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="人気ジャンル" href="/genres" id={id} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ranked.map(({ genre, workCount }) => (
          <Link
            key={genre.slug}
            href={`/genres/${genre.slug}`}
            className="group rounded-lg border border-border/80 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
          >
            <span className="text-sm font-semibold text-foreground group-hover:text-accent">
              {genre.name}
            </span>
            <span className="mt-1.5 block text-xs text-muted">{workCount}作品</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
