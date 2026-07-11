import type { DmmItem } from "@/lib/dmm/types";

export type ImportFetchSort = "popular";

export type FetchedImportCandidate = {
  item: DmmItem;
  contentId: string;
  productId: string;
  rankPosition: number | null;
};

export type FetchImportCandidatesSummary = {
  requestedCount: number;
  apiFetchedCount: number;
  publishedExcludedCount: number;
  duplicateExcludedCount: number;
  invalidExcludedCount: number;
  imageMissingExcludedCount: number;
  candidateCount: number;
  startOffset: number;
  nextOffset: number;
};

export type FetchImportCandidatesResult = {
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary;
};

export type AddSelectedWorksSummary = {
  selectedCount: number;
  addedCount: number;
  catalogDuplicateCount: number;
  selectionDuplicateCount: number;
  invalidCount: number;
  retried: boolean;
};

export type AddSelectedWorkInput = {
  contentId: string;
  item: DmmItem;
  sourcePopularityRank?: number | null;
};
