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
  apiFetchedCount: number;
  pagesFetched: number;
  addedCandidateCount: number;
  exclusionStats: ImportCollectExclusionStats;
  collectionState: ImportCollectionState;
  nextPastOffset: number;
  cycledPastCollection: boolean;
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
