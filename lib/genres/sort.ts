export type GenreSortKey = "works" | "name";

export const DEFAULT_GENRE_SORT: GenreSortKey = "works";

export const GENRE_SORT_OPTIONS: Array<{
  key: GenreSortKey;
  label: string;
}> = [
  { key: "works", label: "作品数が多い順" },
  { key: "name", label: "名前順" },
];

export type GenreListItem = {
  name: string;
  slug: string;
  workCount: number;
  reading: string;
};

export function parseGenreSortParam(value?: string | null): GenreSortKey {
  if (value === "name") return "name";
  return DEFAULT_GENRE_SORT;
}

export function sortGenres(
  items: GenreListItem[],
  sort: GenreSortKey,
): GenreListItem[] {
  const sorted = [...items];

  if (sort === "name") {
    return sorted.sort((a, b) =>
      a.reading.localeCompare(b.reading, "ja"),
    );
  }

  return sorted.sort(
    (a, b) =>
      b.workCount - a.workCount || a.reading.localeCompare(b.reading, "ja"),
  );
}

export function buildGenreListUrl(
  basePath: string,
  params: { sort?: GenreSortKey },
): string {
  if (!params.sort || params.sort === DEFAULT_GENRE_SORT) {
    return basePath;
  }

  const searchParams = new URLSearchParams({ sort: params.sort });
  return `${basePath}?${searchParams.toString()}`;
}
