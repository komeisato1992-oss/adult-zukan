import Link from "next/link";
import { getGenreDetailPath } from "@/lib/entities/paths";
import type { RankedNameCount } from "@/lib/works/catalog";

export const HOME_GENRE_DISPLAY_LIMIT = 15;

type HomeGenreDiscoverSectionProps = {
  genres: RankedNameCount[];
  id?: string;
};

const chipClassName =
  "inline-flex min-h-[36px] flex-col items-center justify-center rounded-md border border-border bg-white px-1 py-1.5 text-center transition-colors hover:border-accent hover:text-accent";

/**
 * スマホTOP専用: 人気女優の下に置く「ジャンルから探す」。
 * 「作品を探す」と同じチップスタイルの4列グリッド。
 */
export function HomeGenreDiscoverSection({
  genres,
  id = "home-genres",
}: HomeGenreDiscoverSectionProps) {
  const visible = genres.slice(0, HOME_GENRE_DISPLAY_LIMIT);
  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="mb-8 min-[769px]:hidden"
    >
      <h2
        id={id}
        className="mb-3 border-l-4 border-accent pl-3 text-base font-bold text-foreground"
      >
        ジャンルから探す
      </h2>
      <div className="grid grid-cols-4 gap-1.5">
        {visible.map((genre) => (
          <Link
            key={genre.slug}
            href={getGenreDetailPath(genre.slug)}
            prefetch
            className={`${chipClassName} text-foreground`}
          >
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">
              {genre.name}
            </span>
            {genre.workCount > 0 ? (
              <span className="mt-0.5 text-[9px] leading-none text-muted">
                {genre.workCount.toLocaleString("ja-JP")}作品
              </span>
            ) : null}
          </Link>
        ))}
        <Link
          href="/genres"
          prefetch
          className={`${chipClassName} font-semibold text-accent`}
          aria-label="ジャンル一覧をもっと見る"
        >
          <span className="text-[11px] leading-tight">もっと見る →</span>
        </Link>
      </div>
    </section>
  );
}
