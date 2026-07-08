"use client";

const FAVORITES_KEY = "favorite_works";
const LEGACY_FAVORITES_KEY = "adult_zukan_favorites";

export const FAVORITES_STORAGE_KEY = FAVORITES_KEY;
export const FAVORITES_CHANGED_EVENT = "favorite-works-changed";

let favoriteIdsCache: string[] | null = null;

function invalidateFavoriteCache(): void {
  favoriteIdsCache = null;
}

function readRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
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
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}

function normalizeId(entry: unknown): string | null {
  if (typeof entry === "string") {
    const id = entry.trim();
    return id || null;
  }

  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const id = String(record.content_id ?? record.slug ?? "").trim();
  return id || null;
}

function migrateLegacyIfNeeded(): string[] {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_FAVORITES_KEY);
    if (!legacyRaw) return [];
    const parsed = JSON.parse(legacyRaw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const ids = [
      ...new Set(
        parsed
          .map(normalizeId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (ids.length > 0) {
      writeIds(ids);
      localStorage.removeItem(LEGACY_FAVORITES_KEY);
    }

    return ids;
  } catch {
    return [];
  }
}

/** Returns favorite content_id list. Persists as string[] only. */
export function getFavoriteIds(): string[] {
  if (favoriteIdsCache) return favoriteIdsCache;

  const raw = readRaw();
  const ids = [
    ...new Set(
      raw.map(normalizeId).filter((id): id is string => Boolean(id)),
    ),
  ];

  if (ids.length > 0) {
    if (raw.length !== ids.length || raw.some((entry) => typeof entry !== "string")) {
      writeIds(ids);
    } else {
      favoriteIdsCache = ids;
    }
    return ids;
  }

  const migrated = migrateLegacyIfNeeded();
  favoriteIdsCache = migrated;
  return migrated;
}

export function isFavorite(contentId: string): boolean {
  const id = contentId.trim();
  if (!id) return false;
  return getFavoriteIds().includes(id);
}

export function addFavorite(contentId: string): string[] {
  const id = contentId.trim();
  if (!id) return getFavoriteIds();

  const current = getFavoriteIds();
  if (current.includes(id)) return current;

  const next = [id, ...current];
  writeIds(next);
  return next;
}

export function removeFavorite(contentId: string): string[] {
  const id = contentId.trim();
  if (!id) return getFavoriteIds();

  const next = getFavoriteIds().filter((entry) => entry !== id);
  writeIds(next);
  return next;
}

export function toggleFavorite(contentId: string): string[] {
  const id = contentId.trim();
  if (!id) return getFavoriteIds();

  return isFavorite(id) ? removeFavorite(id) : addFavorite(id);
}

export function clearFavorites(): void {
  writeIds([]);
}

export function invalidateFavoriteIdsCache(): void {
  invalidateFavoriteCache();
}
