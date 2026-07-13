import {
  DOUJIN_COMPARE_SELECT_PAGE_SIZE,
  type DoujinSimilaritySort,
} from "@/lib/doujin/compare/similarity";

export const DOUJIN_COMPARE_URL_MAX_ITEMS = 4;

export function sanitizeDoujinCompareIds(
  ids: string[],
  max = DOUJIN_COMPARE_URL_MAX_ITEMS,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
}

export function normalizeDoujinCompareIds(ids: string[]): string[] {
  return [...sanitizeDoujinCompareIds(ids)].sort((a, b) => a.localeCompare(b));
}

export function parseDoujinCompareIdsParam(
  value: string | null | undefined,
  max = DOUJIN_COMPARE_URL_MAX_ITEMS,
): string[] {
  if (!value?.trim()) return [];
  return sanitizeDoujinCompareIds(value.split(","), max);
}

export function buildDoujinComparePageHref(ids: string[]): string {
  const ordered = sanitizeDoujinCompareIds(ids);
  if (ordered.length === 0) return "/doujin/compare";
  return `/doujin/compare?ids=${encodeURIComponent(ordered.join(","))}`;
}

export function buildDoujinCompareCanonicalPath(ids: string[]): string {
  const sorted = normalizeDoujinCompareIds(ids);
  if (sorted.length === 0) return "/doujin/compare";
  return `/doujin/compare?ids=${encodeURIComponent(sorted.join(","))}`;
}

export function buildDoujinCompareSelectHref(
  workId: string,
  options?: {
    sort?: DoujinSimilaritySort;
    page?: number;
  },
): string {
  const base = `/doujin/compare/select/${encodeURIComponent(workId)}`;
  const params = new URLSearchParams();
  const sort = options?.sort ?? "overall";
  const page = options?.page ?? 1;

  if (sort !== "overall") {
    params.set("sort", sort);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function getDoujinCompareSelectTotalPages(totalItems: number): number {
  return Math.min(
    10,
    Math.max(1, Math.ceil(totalItems / DOUJIN_COMPARE_SELECT_PAGE_SIZE)),
  );
}
