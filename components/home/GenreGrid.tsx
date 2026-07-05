import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Genre } from "@/data/types";
import { getAllWorks } from "@/lib/works/repository";

type GenreGridProps = {
  genres: Genre[];
};

export async function GenreGrid({ genres }: GenreGridProps) {
  const allWorks = await getAllWorks();

  return (
    <section aria-labelledby="genre-heading" className="mb-4">
      <SectionHeader title="ジャンルから探す" href="/genres" id="genre-heading" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map((genre) => {
          const workCount = allWorks.filter(
            (work) =>
              work.genreSlugs.includes(genre.slug) ||
              work.genreNames.includes(genre.name),
          ).length;

          return (
            <Link
              key={genre.slug}
              href={`/genres/${genre.slug}`}
              className="group rounded-lg border border-border/80 bg-white p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
            >
              <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                {genre.name}
              </span>
              <span className="mt-1.5 block text-xs text-muted">
                {workCount}作品
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
