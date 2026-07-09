import { normalizeSearchText } from "@/lib/search/normalize-text";

export { katakanaToHiragana, normalizeSearchText } from "@/lib/search/normalize-text";

/** @deprecated normalizeSearchText を使用 */
export function normalizeSearchQuery(query: string): string {
  return normalizeSearchText(query);
}
