import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";

export type ImportCollectProgress = {
  active: boolean;
  mode: ImportCollectionMode | null;
  requestedCount: number;
  apiFetchedCount: number;
  currentPage: number;
  plannedPages: number;
  startOffset: number;
};

const idleProgress: ImportCollectProgress = {
  active: false,
  mode: null,
  requestedCount: 0,
  apiFetchedCount: 0,
  currentPage: 0,
  plannedPages: 0,
  startOffset: 1,
};

let collectProgress: ImportCollectProgress = { ...idleProgress };

export function resetImportCollectProgress(): void {
  collectProgress = { ...idleProgress };
}

export function startImportCollectProgress(input: {
  mode: ImportCollectionMode;
  requestedCount: number;
  plannedPages: number;
  startOffset: number;
}): void {
  collectProgress = {
    active: true,
    mode: input.mode,
    requestedCount: input.requestedCount,
    apiFetchedCount: 0,
    currentPage: 0,
    plannedPages: input.plannedPages,
    startOffset: input.startOffset,
  };
}

export function updateImportCollectProgress(input: {
  apiFetchedCount: number;
  currentPage: number;
}): void {
  if (!collectProgress.active) return;

  collectProgress = {
    ...collectProgress,
    apiFetchedCount: input.apiFetchedCount,
    currentPage: input.currentPage,
  };
}

export function getImportCollectProgress(): ImportCollectProgress {
  return collectProgress;
}
