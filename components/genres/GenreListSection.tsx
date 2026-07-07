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

type GenreListSectionProps = {
  genres: GenreListItem[];
};

function readSortFromSearch(search: string): GenreSortKey {
  return parseGenreSortParam(new URLSearchParams(search).get("sort"));
}

export function GenreListSection({ genres }: GenreListSectionProps) {
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<GenreSortKey>(() =>
    readSortFromSearch(searchParams.toString()),
  );

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

  const visibleGenres = useMemo(
    () => sortGenres(genres, sort),
    [genres, sort],
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {visibleGenres.map((genre) => (
          <Link
            key={genre.slug}
            href={getGenreDetailPath(genre.slug)}
            className="rounded border border-border bg-white p-5 text-center shadow-sm transition-shadow hover:border-accent/30 hover:shadow-md"
          >
            <h2 className="text-base font-bold text-foreground">{genre.name}</h2>
            <p className="mt-2 text-xs text-muted">{genre.workCount}作品</p>
          </Link>
        ))}
      </div>
    </>
  );
}
