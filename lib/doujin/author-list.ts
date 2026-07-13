import type { DoujinWorkSortKey } from "@/lib/doujin/catalog-types";
import type { DoujinRepresentativeWork } from "@/lib/doujin/author-representative";

export type DoujinAuthorSortKey =
  | "workCount"
  | "new"
  | "rating"
  | "name";

export const DOUJIN_AUTHOR_SORT_OPTIONS: Array<{
  key: DoujinAuthorSortKey;
  label: string;
}> = [
  { key: "workCount", label: "作品数が多い順" },
  { key: "new", label: "新着作品順" },
  { key: "rating", label: "評価順" },
  { key: "name", label: "名前順" },
];

export const DOUJIN_AUTHOR_LIMIT_OPTIONS = [20, 50, 100] as const;
export type DoujinAuthorLimit = (typeof DOUJIN_AUTHOR_LIMIT_OPTIONS)[number];
export const DEFAULT_DOUJIN_AUTHOR_LIMIT: DoujinAuthorLimit = 20;
export const DEFAULT_DOUJIN_AUTHOR_SORT: DoujinAuthorSortKey = "workCount";

export type DoujinAuthorListItem = {
  id: string;
  name: string;
  workCount: number;
  latestReleaseDate: string;
  maxRating: number;
  representativeWork: DoujinRepresentativeWork | null;
};

export type DoujinAuthorListPageData = {
  pageItems: DoujinAuthorListItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  sort: DoujinAuthorSortKey;
  perPage: DoujinAuthorLimit;
};

export function parseDoujinAuthorSortParam(
  value?: string | null,
): DoujinAuthorSortKey {
  switch (value) {
    case "new":
    case "rating":
    case "name":
      return value;
    case "workCount":
    default:
      return DEFAULT_DOUJIN_AUTHOR_SORT;
  }
}

export function parseDoujinAuthorLimitParam(
  value?: string | null,
): DoujinAuthorLimit {
  const parsed = Number(value);
  if (parsed === 50 || parsed === 100) return parsed;
  return DEFAULT_DOUJIN_AUTHOR_LIMIT;
}

export function buildDoujinAuthorListUrl(options: {
  sort?: DoujinAuthorSortKey;
  perPage?: DoujinAuthorLimit;
  page?: number;
}): string {
  const params = new URLSearchParams();
  const sort = options.sort ?? DEFAULT_DOUJIN_AUTHOR_SORT;
  const perPage = options.perPage ?? DEFAULT_DOUJIN_AUTHOR_LIMIT;
  const page = options.page ?? 1;

  if (sort !== DEFAULT_DOUJIN_AUTHOR_SORT) params.set("sort", sort);
  if (perPage !== DEFAULT_DOUJIN_AUTHOR_LIMIT) {
    params.set("perPage", String(perPage));
  }
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/doujin/authors?${qs}` : "/doujin/authors";
}

export const DOUJIN_AUTHOR_WORK_SORT_OPTIONS: Array<{
  key: DoujinWorkSortKey;
  label: string;
}> = [
  { key: "new", label: "新着順" },
  { key: "popular", label: "人気順" },
  { key: "price-asc", label: "価格が安い順" },
  { key: "price-desc", label: "価格が高い順" },
  { key: "rating", label: "評価順" },
  { key: "discount", label: "セール率順" },
];

export function parseDoujinAuthorWorkSortParam(
  value?: string | null,
): DoujinWorkSortKey {
  const allowed = new Set(
    DOUJIN_AUTHOR_WORK_SORT_OPTIONS.map((option) => option.key),
  );
  if (value && allowed.has(value as DoujinWorkSortKey)) {
    return value as DoujinWorkSortKey;
  }
  return "new";
}
