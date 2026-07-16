export const WORKS_LIST_PAGE_SIZE = 20;
export const CATALOG_DETAIL_PAGE_SIZE = 24;
export const HOME_SECTION_DISPLAY_LIMIT = 6;
export const RELATED_WORKS_DISPLAY_LIMIT = 8;

export function parsePageParam(value?: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export type PaginatedResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
};

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
    totalItems,
    pageSize,
  };
}

export function buildPaginationHref(
  basePath: string,
  page: number,
  query: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
