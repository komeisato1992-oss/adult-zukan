export type ActressSortKey = "popular" | "new" | "works" | "name";

export const DEFAULT_ACTRESS_SORT: ActressSortKey = "popular";

export const ACTRESS_SORT_OPTIONS: Array<{
  key: ActressSortKey;
  label: string;
}> = [
  { key: "popular", label: "人気順" },
  { key: "new", label: "新着順" },
  { key: "works", label: "掲載作品数順" },
  { key: "name", label: "五十音順" },
];

export const ACTRESS_SORT_SELECT_OPTIONS: Array<{
  key: ActressSortKey;
  label: string;
}> = [
  { key: "popular", label: "人気順" },
  { key: "works", label: "作品数が多い順" },
  { key: "name", label: "名前順" },
];

export const ACTRESS_LIMIT_OPTIONS = [20, 50, 100] as const;
export type ActressLimit = (typeof ACTRESS_LIMIT_OPTIONS)[number];
export const DEFAULT_ACTRESS_LIMIT: ActressLimit = 20;

export type ActressListItem = {
  name: string;
  slug: string;
  workCount: number;
  imageUrl?: string;
  reading: string;
  imageFromMultiActressWork?: boolean;
  latestReleaseTimestamp: number;
  popularOrder: number;
};

export type ActressListPageData = {
  pageItems: ActressListItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  sort: ActressSortKey;
  limit: ActressLimit;
  q: string;
};

function compareActressByReading(a: ActressListItem, b: ActressListItem): number {
  const readingA = a.reading ?? a.name;
  const readingB = b.reading ?? b.name;
  return readingA.localeCompare(readingB, "ja");
}

export function parseActressSortParam(value?: string | null): ActressSortKey {
  switch (value) {
    case "new":
      return "new";
    case "works":
    case "work-count":
      return "works";
    case "name":
      return "name";
    case "popular":
    default:
      return DEFAULT_ACTRESS_SORT;
  }
}

export function parseActressLimitParam(value?: string | null): ActressLimit {
  const parsed = Number(value);
  if (parsed === 50 || parsed === 100) {
    return parsed;
  }
  return DEFAULT_ACTRESS_LIMIT;
}

export function sortActresses(
  items: ActressListItem[],
  sort: ActressSortKey,
): ActressListItem[] {
  const sorted = [...items];

  switch (sort) {
    case "new":
      return sorted.sort(
        (a, b) =>
          b.latestReleaseTimestamp - a.latestReleaseTimestamp ||
          a.name.localeCompare(b.name, "ja"),
      );
    case "works":
      return sorted.sort(
        (a, b) =>
          b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
      );
    case "name":
      return sorted.sort(compareActressByReading);
    case "popular":
    default:
      return sorted.sort(
        (a, b) =>
          a.popularOrder - b.popularOrder ||
          b.workCount - a.workCount ||
          a.name.localeCompare(b.name, "ja"),
      );
  }
}

export function buildActressListQuery(params: {
  sort?: ActressSortKey;
  limit?: ActressLimit;
  page?: number;
  q?: string;
}): Record<string, string | undefined> {
  return {
    sort: params.sort === DEFAULT_ACTRESS_SORT ? undefined : params.sort,
    limit: params.limit === DEFAULT_ACTRESS_LIMIT ? undefined : String(params.limit),
    page: params.page && params.page > 1 ? String(params.page) : undefined,
    q: params.q?.trim() || undefined,
  };
}

export function buildActressListUrl(
  basePath: string,
  params: {
    sort?: ActressSortKey;
    limit?: ActressLimit;
    page?: number;
    q?: string;
  },
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(buildActressListQuery(params))) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}
