"use client";

const HISTORY_KEY = "adult_zukan_history";
const MAX_HISTORY = 20;

export type StoredWork = {
  slug: string;
  title: string;
  productCode: string;
  viewedAt: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getHistory(): StoredWork[] {
  return readJson<StoredWork[]>(HISTORY_KEY, []);
}

export function addToHistory(work: Omit<StoredWork, "viewedAt">): StoredWork[] {
  const entry: StoredWork = { ...work, viewedAt: new Date().toISOString() };
  const current = getHistory().filter((item) => item.slug !== work.slug);
  const next = [entry, ...current].slice(0, MAX_HISTORY);
  writeJson(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
