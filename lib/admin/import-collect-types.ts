import type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";
import type { ImportCollectionState } from "@/lib/admin/import-collection-state";

export type ImportCollectionMode = "new" | "past" | "popular";

export type ImportCollectExclusionStats = {
  catalogPublished: number;
  alreadyAdded: number;
  alreadyExcluded: number;
  alreadyPending: number;
  alreadyFetched: number;
  noImage: number;
  invalid: number;
  duplicate: number;
};

export type ImportCollectRunStats = {
  mode: ImportCollectionMode;
  requestedCount: number;
  apiFetchedCount: number;
  validatedCount: number;
  validCandidateCount: number;
  pagesFetched: number;
  plannedPages: number;
  addedCandidateCount: number;
  exclusionStats: ImportCollectExclusionStats;
  collectionState: ImportCollectionState;
  startOffset: number;
  nextOffset: number;
  cycledPastCollection: boolean;
  fetchCompleted: boolean;
  currentCatalogCount: number;
  targetTotalCount: number;
  remainingToTarget: number;
};

export type CollectImportCandidatesOptions = {
  mode: ImportCollectionMode;
  requestCount?: number;
  /** 空欄相当は undefined。past / popular で使用。 */
  startOffset?: number | null;
  targetTotalCount?: number;
};

export type CollectImportCandidatesResult = {
  success: boolean;
  configured: boolean;
  collectedCount: number;
  displayedCount: number;
  count: number;
  message: string;
  candidates: ImportCandidatesListResult["candidates"];
  /** 今回の収集で新規追加された候補（ページング前の全件） */
  collectedThisRun: ImportCandidatesListResult["candidates"];
  summary: ImportCandidatesListResult["summary"];
  pagination: ImportCandidatesListResult["pagination"];
  runStats?: ImportCollectRunStats;
};

export type PopularBatchCollectOptions = {
  targetTotalCount: number;
  startOffset?: number | null;
  requestCount: number;
  addLimit: number;
  maxBatches: number;
};

export type PopularBatchCollectResult = {
  success: boolean;
  processId: string;
  message: string;
  collectResult?: CollectImportCandidatesResult;
  addResult?: {
    addedCount: number;
    skippedExistingCount: number;
    invalidCount: number;
    failedCount: number;
    committedToGitHub: boolean;
  };
  job: import("@/lib/admin/import-batch-job").ImportBatchJob;
};
