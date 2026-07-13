"use client";

const DOUJIN_HISTORY_KEY = "doujin_history";
const MAX_HISTORY = 20;

export type DoujinStoredWork = {
  id: string;
  title: string;
  circleId?: string;
  circleName?: string;
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

export function getDoujinHistory(): DoujinStoredWork[] {
  return readJson<DoujinStoredWork[]>(DOUJIN_HISTORY_KEY, []);
}

export function addToDoujinHistory(
  work: Omit<DoujinStoredWork, "viewedAt">,
): DoujinStoredWork[] {
  const entry: DoujinStoredWork = {
    ...work,
    viewedAt: new Date().toISOString(),
  };
  const current = getDoujinHistory().filter((item) => item.id !== work.id);
  const next = [entry, ...current].slice(0, MAX_HISTORY);
  writeJson(DOUJIN_HISTORY_KEY, next);
  return next;
}

export function clearDoujinHistory(): void {
  localStorage.removeItem(DOUJIN_HISTORY_KEY);
}
