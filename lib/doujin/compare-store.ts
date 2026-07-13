"use client";

export const DOUJIN_COMPARE_STORAGE_KEY = "doujin_compare_items";
export const DOUJIN_COMPARE_MAX_ITEMS = 3;
const COMPARE_EVENT = "doujin:compare-updated";
export const DOUJIN_COMPARE_LIMIT_EVENT = "doujin:compare-limit-reached";

let compareIdsCache: string[] | null = null;

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, DOUJIN_COMPARE_MAX_ITEMS);
}

export function readDoujinCompareIds(): string[] {
  if (compareIdsCache) return compareIdsCache;
  if (typeof window === "undefined") return [];
  try {
    compareIdsCache = normalizeIds(
      JSON.parse(window.localStorage.getItem(DOUJIN_COMPARE_STORAGE_KEY) ?? "[]"),
    );
  } catch {
    compareIdsCache = [];
  }
  return compareIdsCache;
}

export function isDoujinCompareId(workId: string): boolean {
  const trimmed = workId.trim();
  if (!trimmed) return false;
  return readDoujinCompareIds().includes(trimmed);
}

function writeCompareIds(ids: string[]) {
  compareIdsCache = normalizeIds(ids);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DOUJIN_COMPARE_STORAGE_KEY,
    JSON.stringify(compareIdsCache),
  );
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

export function clearDoujinCompareIds() {
  writeCompareIds([]);
}

export function setDoujinCompareIds(ids: string[]) {
  writeCompareIds(ids);
}

export function toggleDoujinCompareId(workId: string): {
  ids: string[];
  added: boolean;
  error?: string;
} {
  const trimmed = workId.trim();
  if (!trimmed) {
    return { ids: readDoujinCompareIds(), added: false, error: "比較対象が不正です" };
  }

  const current = readDoujinCompareIds();
  if (current.includes(trimmed)) {
    const next = current.filter((id) => id !== trimmed);
    writeCompareIds(next);
    return { ids: next, added: false };
  }

  if (current.length >= DOUJIN_COMPARE_MAX_ITEMS) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(DOUJIN_COMPARE_LIMIT_EVENT));
    }
    return { ids: current, added: false, error: "比較は3作品までです" };
  }

  const next = [...current, trimmed];
  writeCompareIds(next);
  return { ids: next, added: true };
}

export function subscribeDoujinCompareStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DOUJIN_COMPARE_STORAGE_KEY) {
      compareIdsCache = null;
      callback();
    }
  };
  const onUpdate = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(COMPARE_EVENT, onUpdate);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(COMPARE_EVENT, onUpdate);
  };
}
