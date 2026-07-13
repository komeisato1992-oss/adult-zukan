"use client";

export const DOUJIN_FAVORITES_STORAGE_KEY = "doujin_favorites";
export const DOUJIN_FAVORITES_CHANGED_EVENT = "doujin-favorites-changed";

let favoriteIdsCache: string[] | null = null;

function readRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DOUJIN_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  favoriteIdsCache = ids;
  localStorage.setItem(DOUJIN_FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(DOUJIN_FAVORITES_CHANGED_EVENT));
}

function normalizeId(entry: unknown): string | null {
  if (typeof entry === "string") {
    const id = entry.trim();
    return id || null;
  }
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const id = String(record.id ?? record.content_id ?? record.slug ?? "").trim();
  return id || null;
}

export function getDoujinFavoriteIds(): string[] {
  if (favoriteIdsCache) return favoriteIdsCache;
  const ids = [
    ...new Set(
      readRaw()
        .map(normalizeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  favoriteIdsCache = ids;
  return ids;
}

export function isDoujinFavorite(workId: string): boolean {
  const id = workId.trim();
  if (!id) return false;
  return getDoujinFavoriteIds().includes(id);
}

export function toggleDoujinFavorite(workId: string): string[] {
  const id = workId.trim();
  if (!id) return getDoujinFavoriteIds();
  const current = getDoujinFavoriteIds();
  const next = current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [id, ...current];
  writeIds(next);
  return next;
}

export function clearDoujinFavorites(): void {
  writeIds([]);
}
