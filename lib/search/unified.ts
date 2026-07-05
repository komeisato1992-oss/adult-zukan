import "server-only";

import type { Work } from "@/data/types";
import { searchActresses } from "@/data/actresses";
import { getAllMakers } from "@/data/makers";
import { getAllSeries } from "@/data/series";
import { getAllGenres } from "@/data/genres";
import { searchWorks } from "@/lib/works/repository";

export type SearchResultCategory = "works" | "actresses" | "makers" | "series" | "genres";

export type UnifiedSearchResults = {
  works: Work[];
  actresses: ReturnType<typeof searchActresses>;
  makers: ReturnType<typeof getAllMakers>;
  series: ReturnType<typeof getAllSeries>;
  genres: ReturnType<typeof getAllGenres>;
  total: number;
};

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export async function unifiedSearch(query: string): Promise<UnifiedSearchResults> {
  const normalized = query.trim();
  if (!normalized) {
    return {
      works: [],
      actresses: [],
      makers: [],
      series: [],
      genres: [],
      total: 0,
    };
  }

  const works = await searchWorks(normalized);
  const actresses = searchActresses(normalized);
  const makers = getAllMakers().filter(
    (maker) =>
      matchesQuery(maker.name, normalized) ||
      matchesQuery(maker.description, normalized) ||
      matchesQuery(maker.longDescription, normalized),
  );
  const series = getAllSeries().filter(
    (s) =>
      matchesQuery(s.name, normalized) ||
      matchesQuery(s.description, normalized) ||
      matchesQuery(s.longDescription, normalized),
  );
  const genres = getAllGenres().filter(
    (genre) =>
      matchesQuery(genre.name, normalized) ||
      matchesQuery(genre.description, normalized) ||
      matchesQuery(genre.longDescription, normalized),
  );

  return {
    works,
    actresses,
    makers,
    series,
    genres,
    total: works.length + actresses.length + makers.length + series.length + genres.length,
  };
}