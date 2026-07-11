import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import type { ImportFilterKey } from "@/lib/admin/import-quality";

export type ImportSelectionFilters = {
  filters: ImportFilterKey[];
  sort: ImportCandidateSortKey;
};

export type ImportSelectionState =
  | { mode: "none" }
  | { mode: "explicit"; selectedIds: Set<string> }
  | {
      mode: "allMatching";
      excludedIds: Set<string>;
      filters: ImportFilterKey[];
      sort: ImportCandidateSortKey;
    };

export function createEmptySelectionState(): ImportSelectionState {
  return { mode: "none" };
}

export function countSelected(
  selection: ImportSelectionState,
  filteredTotalCount: number,
): number {
  if (selection.mode === "none") return 0;
  if (selection.mode === "explicit") return selection.selectedIds.size;
  return Math.max(0, filteredTotalCount - selection.excludedIds.size);
}

export function isCandidateSelected(
  selection: ImportSelectionState,
  contentId: string,
): boolean {
  if (selection.mode === "none") return false;
  if (selection.mode === "explicit") return selection.selectedIds.has(contentId);
  return !selection.excludedIds.has(contentId);
}

export function toggleCandidateSelection(
  selection: ImportSelectionState,
  contentId: string,
  selected: boolean,
  context: ImportSelectionFilters,
): ImportSelectionState {
  if (selection.mode === "allMatching") {
    const excludedIds = new Set(selection.excludedIds);
    if (selected) {
      excludedIds.delete(contentId);
    } else {
      excludedIds.add(contentId);
    }
    return { ...selection, excludedIds };
  }

  const selectedIds =
    selection.mode === "explicit"
      ? new Set(selection.selectedIds)
      : new Set<string>();

  if (selected) {
    selectedIds.add(contentId);
  } else {
    selectedIds.delete(contentId);
  }

  if (selectedIds.size === 0) {
    return { mode: "none" };
  }

  return { mode: "explicit", selectedIds };
}

export function selectAllMatching(
  context: ImportSelectionFilters,
): ImportSelectionState {
  return {
    mode: "allMatching",
    excludedIds: new Set(),
    filters: [...context.filters],
    sort: context.sort,
  };
}

export function selectExplicitIds(ids: Iterable<string>): ImportSelectionState {
  const selectedIds = new Set(ids);
  if (selectedIds.size === 0) {
    return { mode: "none" };
  }
  return { mode: "explicit", selectedIds };
}

export function clearSelectionState(): ImportSelectionState {
  return { mode: "none" };
}

export type BulkAddSelectionRequest =
  | {
      mode: "explicit";
      selectedWorks: Array<{ contentId: string; item: unknown }>;
      addLimit?: number | string;
    }
  | {
      mode: "allMatching";
      excludedIds: string[];
      filters: ImportFilterKey[];
      sort: ImportCandidateSortKey;
      addLimit?: number | string;
    };

export function serializeSelectionForBulkAdd(
  selection: ImportSelectionState,
  selectedWorks: Array<{ contentId: string; item: unknown }>,
  addLimit: number | string,
): BulkAddSelectionRequest {
  if (selection.mode === "allMatching") {
    return {
      mode: "allMatching",
      excludedIds: [...selection.excludedIds],
      filters: [...selection.filters],
      sort: selection.sort,
      addLimit,
    };
  }

  return {
    mode: "explicit",
    selectedWorks,
    addLimit,
  };
}
