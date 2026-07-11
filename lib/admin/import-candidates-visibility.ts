import { storedCandidateToDmmItem } from "@/lib/admin/import-candidate-mapper";
import type {
  ImportCandidateListItem,
  ImportCandidatesSummary,
  StoredImportCandidate,
} from "@/lib/admin/import-candidate-types";
import type { ImportCollectionState } from "@/lib/admin/import-collection-state";
import { createDefaultImportCollectionState } from "@/lib/admin/import-collection-state";
import { IMPORT_COLLECT_PAGE_SIZE } from "@/lib/admin/import-constants";

export function isAddedImportCandidate(
  candidate: Pick<
    ImportCandidateListItem,
    "status" | "isAdded" | "contentId" | "item"
  >,
): boolean {
  return candidate.status === "added" || candidate.isAdded === true;
}

export function isExcludedImportCandidate(
  candidate: Pick<
    ImportCandidateListItem,
    "status" | "isExcluded" | "contentId" | "item"
  >,
): boolean {
  return candidate.status === "excluded" || candidate.isExcluded === true;
}

export function isVisibleImportCandidate(
  candidate: Pick<ImportCandidateListItem, "contentId" | "item" | "status" | "isAdded" | "isExcluded">,
): boolean {
  if (isAddedImportCandidate(candidate)) return false;
  if (isExcludedImportCandidate(candidate)) return false;

  const id = candidate.contentId?.trim() || candidate.item?.content_id?.trim();
  const title = candidate.item?.title?.trim();
  return Boolean(id && title);
}

export function isVisibleStoredCandidate(record: StoredImportCandidate): boolean {
  if (record.status === "added" || record.status === "excluded") return false;

  const id = record.content_id?.trim();
  const title =
    record.title?.trim() || storedCandidateToDmmItem(record).title?.trim();
  return Boolean(id && title);
}

export function storedRecordToListItem(
  record: StoredImportCandidate,
): ImportCandidateListItem {
  return {
    contentId: record.content_id,
    item: storedCandidateToDmmItem(record),
    source: record.source,
    collectedAt: record.collectedAt,
    status: record.status,
    isAdded: record.status === "added",
    isExcluded: record.status === "excluded",
  };
}

export function buildSummaryFromListItems(
  candidates: ImportCandidateListItem[],
  publishedCount: number,
  catalogTotalCount: number,
  collectionState?: ImportCollectionState,
): ImportCandidatesSummary {
  let lastCollectedAt: string | null = null;

  for (const candidate of candidates) {
    if (!lastCollectedAt || candidate.collectedAt > lastCollectedAt) {
      lastCollectedAt = candidate.collectedAt;
    }
  }

  const state =
    collectionState ?? createDefaultImportCollectionState(IMPORT_COLLECT_PAGE_SIZE);

  return {
    publishedCount,
    catalogTotalCount,
    candidateCount: candidates.filter(isVisibleImportCandidate).length,
    addedCount: candidates.filter(isAddedImportCandidate).length,
    excludedCount: candidates.filter(isExcludedImportCandidate).length,
    lastCollectedAt,
    lastNewCollectedAt: state.lastNewCollectedAt,
    lastPastCollectedAt: state.lastPastCollectedAt,
    collectionState: {
      pastOffset: state.pastOffset,
      nextPastOffset: state.pastOffset,
      lastPastStartOffset: state.lastPastStartOffset,
      pageSize: state.pageSize || IMPORT_COLLECT_PAGE_SIZE,
      cycleCount: state.cycleCount,
    },
  };
}
