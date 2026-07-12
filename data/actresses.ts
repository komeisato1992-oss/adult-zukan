import catalog from "./catalog/index";
import type { Actress } from "./types";

export const actresses: Actress[] = catalog.actresses;

export function getAllActresses(): Actress[] {
  return actresses;
}

export function getActressBySlug(slug: string): Actress | undefined {
  return actresses.find((actress) => actress.slug === slug);
}

export function getRankedActresses(limit = 10): Actress[] {
  // ダミーカタログ由来。公開ランキングは getPopularActresses を使うこと。
  return [...actresses]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, limit);
}

export function searchActresses(query: string): Actress[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return actresses;

  return actresses.filter(
    (actress) =>
      actress.name.toLowerCase().includes(normalized) ||
      actress.description.toLowerCase().includes(normalized) ||
      actress.profile.toLowerCase().includes(normalized),
  );
}

export function getRelatedActresses(slug: string): Actress[] {
  const actress = getActressBySlug(slug);
  if (!actress) return [];
  return actress.relatedActressSlugs
    .map((s) => getActressBySlug(s))
    .filter((a): a is Actress => a !== undefined);
}
