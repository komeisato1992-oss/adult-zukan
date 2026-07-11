import type { DmmItem } from "@/lib/dmm/types";

export type ImportFetchSort = "popular";

export type ImportCandidateMeta = {
  sourceSort: ImportFetchSort;
  sourceOffset: number;
  sourceIndex: number;
  absolutePopularityPosition: number;
};

export type FetchedImportCandidate = {
  item: DmmItem;
  contentId: string;
  productId: string;
  /** 追加時の sourcePopularityRank 用（= absolutePopularityPosition） */
  rankPosition: number | null;
  candidateMeta: ImportCandidateMeta;
};

export type FetchImportCandidatesSummary = {
  requestedCount: number;
  maxScanCount: number;
  apiFetchedCount: number;
  publishedExcludedCount: number;
  duplicateExcludedCount: number;
  invalidExcludedCount: number;
  imageMissingExcludedCount: number;
  candidateCount: number;
  catalogCount: number;
  startOffset: number;
  nextOffset: number;
  scanStartOffset: number;
  scanEndOffset: number;
  popularityRangeMin: number | null;
  popularityRangeMax: number | null;
  targetReached: boolean;
  message: string;
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
