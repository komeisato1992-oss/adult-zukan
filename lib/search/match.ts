import type { SearchIndexEntry } from "@/lib/search/index";
import { normalizeSearchText } from "@/lib/search/normalize-text";

export function trimSearchQuery(query: string): string {
  return query.trim().replace(/[\s\u3000]+/g, " ");
}

export function normalizeSearchInput(query: string): {
  trimmed: string;
  normalized: string;
} {
  const trimmed = trimSearchQuery(query);
  return {
    trimmed,
    normalized: normalizeSearchText(trimmed),
  };
}

export function searchEntryMatches(
  entry: SearchIndexEntry,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return false;

  return entry.searchFields.some((field) => field.includes(normalizedQuery));
}
