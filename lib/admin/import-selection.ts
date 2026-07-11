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
      totalCount: number;
    };

export type BulkAddSelectionPayload =
  | {
      mode: "explicit";
      selectedIds: string[];
    }
  | {
      mode: "allMatching";
      excludedIds: string[];
      filters: ImportFilterKey[];
      sort: ImportCandidateSortKey;
      totalCount: number;
    };

export type BulkAddApiRequestBody = {
  selection: BulkAddSelectionPayload;
  addLimit?: number | string;
};

export function createEmptySelectionState(): ImportSelectionState {
  return { mode: "none" };
}

export function getSelectedCount(
  selection: ImportSelectionState,
  filteredTotalCount: number,
): number {
  if (selection.mode === "none") return 0;
  if (selection.mode === "explicit") return selection.selectedIds.size;
  return Math.max(0, selection.totalCount - selection.excludedIds.size);
}

/** @deprecated getSelectedCount を使用してください */
export const countSelected = getSelectedCount;

export function hasSelection(
  selection: ImportSelectionState,
  filteredTotalCount: number,
): boolean {
  return getSelectedCount(selection, filteredTotalCount) > 0;
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
  context: ImportSelectionFilters & { filteredTotalCount: number },
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
  context: ImportSelectionFilters & { filteredTotalCount: number },
): ImportSelectionState {
  return {
    mode: "allMatching",
    excludedIds: new Set(),
    filters: [...context.filters],
    sort: context.sort,
    totalCount: context.filteredTotalCount,
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

export function buildBulkAddApiRequest(
  selection: ImportSelectionState,
  addLimit: number | string,
): BulkAddApiRequestBody | null {
  if (selection.mode === "allMatching") {
    return {
      selection: {
        mode: "allMatching",
        excludedIds: [...selection.excludedIds],
        filters: [...selection.filters],
        sort: selection.sort,
        totalCount: selection.totalCount,
      },
      addLimit,
    };
  }

  if (selection.mode === "explicit") {
    return {
      selection: {
        mode: "explicit",
        selectedIds: [...selection.selectedIds],
      },
      addLimit,
    };
  }

  return null;
}

export function describeSelectionForDebug(
  selection: ImportSelectionState,
  filteredTotalCount: number,
): Record<string, unknown> {
  if (selection.mode === "none") {
    return {
      selectionMode: "none",
      selectedIds: [],
      selectedIdsCount: 0,
      excludedIds: [],
      filters: [],
      selectedCount: 0,
      totalMatchingCount: filteredTotalCount,
    };
  }

  if (selection.mode === "explicit") {
    return {
      selectionMode: "explicit",
      selectedIds: [...selection.selectedIds],
      selectedIdsCount: selection.selectedIds.size,
      excludedIds: [],
      filters: [],
      selectedCount: selection.selectedIds.size,
      totalMatchingCount: filteredTotalCount,
    };
  }

  return {
    selectionMode: "allMatching",
    selectedIds: [],
    selectedIdsCount: 0,
    excludedIds: [...selection.excludedIds],
    filters: [...selection.filters],
    selectedCount: getSelectedCount(selection, filteredTotalCount),
    totalMatchingCount: selection.totalCount,
  };
}
