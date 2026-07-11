import type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";
import type { ImportCollectionState } from "@/lib/admin/import-collection-state";

export type ImportCollectionMode = "new" | "past";

export type ImportCollectExclusionStats = {
  catalogPublished: number;
  alreadyAdded: number;
  alreadyExcluded: number;
  alreadyPending: number;
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
  startPastOffset: number;
  nextPastOffset: number;
  cycledPastCollection: boolean;
  fetchCompleted: boolean;
};

export type CollectImportCandidatesOptions = {
  mode: ImportCollectionMode;
  requestCount?: number;
  /** 空欄相当は undefined。過去作品のみ使用。 */
  startOffset?: number | null;
};

export type CollectImportCandidatesResult = {
  success: boolean;
  configured: boolean;
  collectedCount: number;
  displayedCount: number;
  count: number;
  message: string;
  candidates: ImportCandidatesListResult["candidates"];
  summary: ImportCandidatesListResult["summary"];
  pagination: ImportCandidatesListResult["pagination"];
  runStats?: ImportCollectRunStats;
};
