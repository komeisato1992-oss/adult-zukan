"use client";

export const COMPARE_STORAGE_KEY = "az_compare_ids_v1";
export const COMPARE_MAX_ITEMS = 3;
const COMPARE_EVENT = "az:compare-updated";
export const COMPARE_LIMIT_EVENT = "az:compare-limit-reached";

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, COMPARE_MAX_ITEMS);
}

export function readCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeIds(JSON.parse(window.localStorage.getItem(COMPARE_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeCompareIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizeIds(ids)));
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

export function clearCompareIds() {
  writeCompareIds([]);
}

export function toggleCompareId(contentId: string): {
  ids: string[];
  added: boolean;
  error?: string;
} {
  const trimmed = contentId.trim();
  if (!trimmed) {
    return { ids: readCompareIds(), added: false, error: "比較対象が不正です" };
  }

  const current = readCompareIds();
  const exists = current.includes(trimmed);
  if (exists) {
    const next = current.filter((id) => id !== trimmed);
    writeCompareIds(next);
    return { ids: next, added: false };
  }

  if (current.length >= COMPARE_MAX_ITEMS) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(COMPARE_LIMIT_EVENT));
    }
    return { ids: current, added: false, error: "比較は3作品までです" };
  }

  const next = [...current, trimmed];
  writeCompareIds(next);
  return { ids: next, added: true };
}

export function subscribeCompareStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMPARE_STORAGE_KEY) callback();
  };
  const onUpdate = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(COMPARE_EVENT, onUpdate);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(COMPARE_EVENT, onUpdate);
  };
}
