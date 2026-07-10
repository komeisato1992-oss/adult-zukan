"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getGenreDetailPath } from "@/lib/entities/paths";
import {
  buildGenreListUrl,
  GENRE_SORT_OPTIONS,
  parseGenreSortParam,
  sortGenres,
  type GenreListItem,
  type GenreSortKey,
} from "@/lib/genres/sort";

const BASE_PATH = "/genres";

const GENRE_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

const GENRE_CARD_CLASS =
  "group flex min-h-[60px] items-center rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md sm:min-h-[64px] sm:px-3.5";

type GenreListSectionProps = {
  genres: GenreListItem[];
};

function readSortFromSearch(search: string): GenreSortKey {
  return parseGenreSortParam(new URLSearchParams(search).get("sort"));
}

function formatGenreWorkCount(count: number): string {
  return `${count.toLocaleString("ja-JP")}作品`;
}

export function GenreListSection({ genres }: GenreListSectionProps) {
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<GenreSortKey>(() =>
    readSortFromSearch(searchParams.toString()),
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handlePopState = () => {
      setSort(readSortFromSearch(window.location.search));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextSort = parseGenreSortParam(event.target.value);
      const url = buildGenreListUrl(BASE_PATH, { sort: nextSort });

      window.history.replaceState(null, "", url);
      setSort(nextSort);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [],
  );

  const visibleGenres = useMemo(() => {
    const sorted = sortGenres(genres, sort);
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return sorted;
    }

    return sorted.filter(
      (genre) =>
        genre.name.toLowerCase().includes(keyword) ||
        genre.reading.toLowerCase().includes(keyword),
    );
  }, [genres, sort, query]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[220px] sm:max-w-md">
          <label htmlFor="genre-search" className="sr-only">
            ジャンル名を検索
          </label>
          <input
            id="genre-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ジャンル名を検索"
            autoComplete="off"
            className="h-10 w-full rounded border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="genre-sort" className="text-sm text-muted">
            並び替え
          </label>
          <select
            id="genre-sort"
            value={sort}
            onChange={handleSortChange}
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
          >
            {GENRE_SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleGenres.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          該当するジャンルが見つかりませんでした。
        </p>
      ) : (
        <div className={GENRE_GRID_CLASS}>
          {visibleGenres.map((genre) => (
            <Link
              key={genre.slug}
              href={getGenreDetailPath(genre.slug)}
              className={GENRE_CARD_CLASS}
            >
              <div className="flex min-w-0 w-full items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 text-left text-sm font-bold leading-snug text-foreground line-clamp-2 group-hover:text-accent">
                  {genre.name}
                </h2>
                <p className="shrink-0 pt-0.5 text-right text-[11px] leading-none text-muted tabular-nums sm:text-xs">
                  {formatGenreWorkCount(genre.workCount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
