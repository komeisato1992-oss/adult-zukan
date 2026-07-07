import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getGenreDetailPath } from "@/lib/entities/paths";
import type { ActressPageGenre } from "@/lib/dmm/actress-page";

type ActressGenreLinksProps = {
  genres: ActressPageGenre[];
};

export function ActressGenreLinks({ genres }: ActressGenreLinksProps) {
  if (genres.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="actress-genres" className="mb-10">
      <SectionHeader title="ジャンル" id="actress-genres" />
      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <Link
            key={genre.slug}
            href={getGenreDetailPath(genre.slug)}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
