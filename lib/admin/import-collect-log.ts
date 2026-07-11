import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";

export type ImportCollectLogEntry = {
  collectedAt: string;
  mode: ImportCollectionMode;
  requestedCount: number;
  addedCandidateCount: number;
  validCandidateCount: number;
  averageSeoScore: number;
  topSeoScore: number;
};

export type ImportCollectLogDocument = {
  updatedAt: string;
  entries: ImportCollectLogEntry[];
};

export const IMPORT_COLLECT_LOG_MAX_ENTRIES = 100;

export function createEmptyImportCollectLog(): ImportCollectLogDocument {
  return {
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

export function appendImportCollectLogEntry(
  document: ImportCollectLogDocument,
  entry: ImportCollectLogEntry,
): ImportCollectLogDocument {
  const entries = [entry, ...document.entries].slice(0, IMPORT_COLLECT_LOG_MAX_ENTRIES);
  return {
    updatedAt: new Date().toISOString(),
    entries,
  };
}

export function summarizeSeoScores(scores: number[]): {
  averageSeoScore: number;
  topSeoScore: number;
} {
  if (scores.length === 0) {
    return { averageSeoScore: 0, topSeoScore: 0 };
  }

  const total = scores.reduce((sum, value) => sum + value, 0);
  return {
    averageSeoScore: Math.round(total / scores.length),
    topSeoScore: Math.max(...scores),
  };
}
