import {
  COMPARE_SELECT_PAGE_SIZE,
  type SimilaritySort,
} from "@/lib/compare/similarity";

/** アダルト図鑑の比較上限 */
export const COMPARE_URL_MAX_ITEMS = 4;

/**
 * 追加順を維持したまま重複除去・件数制限
 * （UI表示・localStorage・URLクエリ用）
 */
export function sanitizeCompareIds(
  ids: string[],
  max = COMPARE_URL_MAX_ITEMS,
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

/** canonical 用にソート（A対B / B対A の重複対策） */
export function normalizeCompareIds(ids: string[]): string[] {
  return [...sanitizeCompareIds(ids)].sort((a, b) => a.localeCompare(b));
}

export function parseCompareIdsParam(
  value: string | null | undefined,
  max = COMPARE_URL_MAX_ITEMS,
): string[] {
  if (!value?.trim()) return [];
  return sanitizeCompareIds(value.split(","), max);
}

/** 表示・遷移用（追加順を維持） */
export function buildComparePageHref(ids: string[]): string {
  const ordered = sanitizeCompareIds(ids);
  if (ordered.length === 0) return "/compare";
  return `/compare?ids=${encodeURIComponent(ordered.join(","))}`;
}

/** SEO canonical 用（ソート済み） */
export function buildCompareCanonicalPath(ids: string[]): string {
  const sorted = normalizeCompareIds(ids);
  if (sorted.length === 0) return "/compare";
  return `/compare?ids=${encodeURIComponent(sorted.join(","))}`;
}

export function buildCompareSelectHref(
  contentId: string,
  options?: {
    sort?: SimilaritySort;
    page?: number;
  },
): string {
  const base = `/compare/select/${encodeURIComponent(contentId)}`;
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

export function getCompareSelectTotalPages(totalItems: number): number {
  return Math.min(
    10,
    Math.max(1, Math.ceil(totalItems / COMPARE_SELECT_PAGE_SIZE)),
  );
}
