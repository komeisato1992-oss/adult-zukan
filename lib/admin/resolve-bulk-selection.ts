import "server-only";

import { resolveBulkAddLimit } from "@/lib/admin/bulk-add-limit";
import type { BulkAddWorkInput } from "@/lib/admin/bulk-add-request";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import { loadImportCandidates } from "@/lib/admin/import-candidates-store";
import {
  isVisibleStoredCandidate,
  storedRecordToListItem,
} from "@/lib/admin/import-candidates-visibility";
import { IMPORT_BULK_ADD_ABSOLUTE_MAX } from "@/lib/admin/import-constants";
import type { BulkAddSelectionPayload } from "@/lib/admin/import-selection";
import { hasSelection } from "@/lib/admin/import-selection";
import type { ImportFilterKey } from "@/lib/admin/import-quality";
import { AddWorkValidationError } from "@/lib/admin/add-work";

export type BulkAddResolutionDebug = {
  selectionMode: string;
  receivedSelectedCount: number;
  resolvedCount: number;
  afterLimitCount: number;
  appliedLimit: number;
};

export type BulkAddResolutionResult = {
  works: BulkAddWorkInput[];
  appliedLimit: number;
  selectedCount: number;
  debug: BulkAddResolutionDebug;
};

function readTotalCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function parseSelectionPayload(body: Record<string, unknown>): BulkAddSelectionPayload {
  const nested = body.selection;
  if (nested && typeof nested === "object") {
    const value = nested as Record<string, unknown>;
    if (value.mode === "allMatching") {
      return {
        mode: "allMatching",
        excludedIds: Array.isArray(value.excludedIds)
          ? value.excludedIds.filter((id): id is string => typeof id === "string")
          : [],
        filters: Array.isArray(value.filters)
          ? (value.filters.filter((key): key is ImportFilterKey => typeof key === "string") as ImportFilterKey[])
          : [],
        sort:
          typeof value.sort === "string"
            ? (value.sort as ImportCandidateSortKey)
            : "collectedAt-desc",
        totalCount: readTotalCount(value.totalCount),
      };
    }

    if (value.mode === "explicit") {
      return {
        mode: "explicit",
        selectedIds: Array.isArray(value.selectedIds)
          ? value.selectedIds.filter((id): id is string => typeof id === "string")
          : [],
      };
    }

    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  if (body.mode === "allMatching") {
    return {
      mode: "allMatching",
      excludedIds: Array.isArray(body.excludedIds)
        ? body.excludedIds.filter((id): id is string => typeof id === "string")
        : [],
      filters: Array.isArray(body.filters)
        ? (body.filters.filter((key): key is ImportFilterKey => typeof key === "string") as ImportFilterKey[])
        : [],
      sort:
        typeof body.sort === "string"
          ? (body.sort as ImportCandidateSortKey)
          : "collectedAt-desc",
      totalCount: readTotalCount(body.totalCount),
    };
  }

  const legacyWorks = body.selectedWorks;
  if (Array.isArray(legacyWorks) && legacyWorks.length > 0) {
    const selectedIds = legacyWorks
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const work = entry as { contentId?: string };
        return typeof work.contentId === "string" ? work.contentId.trim() : "";
      })
      .filter(Boolean);

    return {
      mode: "explicit",
      selectedIds,
    };
  }

  throw new AddWorkValidationError("リクエスト形式が不正です。");
}

async function listMatchingCandidates(input: {
  excludedIds: string[];
  filters: ImportFilterKey[];
  sort: ImportCandidateSortKey;
}) {
  const { records } = await loadImportCandidates();
  const list = await buildImportCandidatesListFromRecords(records, {
    page: 1,
    sort: input.sort,
    filters: input.filters,
    includeAll: true,
  });

  const excluded = new Set(
    input.excludedIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );

  return list.candidates.filter(
    (candidate) => !excluded.has(candidate.contentId.trim().toLowerCase()),
  );
}

async function resolveAllMatchingWorks(
  selection: Extract<BulkAddSelectionPayload, { mode: "allMatching" }>,
): Promise<BulkAddWorkInput[]> {
  const candidates = await listMatchingCandidates({
    excludedIds: selection.excludedIds,
    filters: selection.filters,
    sort: selection.sort,
  });

  return candidates.map((candidate) => ({
    contentId: candidate.contentId,
    item: candidate.item,
  }));
}

async function resolveExplicitWorks(
  selection: Extract<BulkAddSelectionPayload, { mode: "explicit" }>,
): Promise<BulkAddWorkInput[]> {
  const normalizedIds = selection.selectedIds
    .map((id) => normalizeImportContentId(id))
    .filter(Boolean);

  if (normalizedIds.length === 0) {
    return [];
  }

  const { records } = await loadImportCandidates();
  const itemById = new Map<string, BulkAddWorkInput>();

  for (const record of records) {
    if (!isVisibleStoredCandidate(record)) continue;

    const listItem = storedRecordToListItem(record);
    const contentId = normalizeImportContentId(listItem.contentId);
    if (!contentId) continue;
    itemById.set(contentId, {
      contentId: listItem.contentId,
      item: listItem.item,
    });
  }

  const works: BulkAddWorkInput[] = [];
  for (const contentId of normalizedIds) {
    const work = itemById.get(contentId);
    if (work) {
      works.push(work);
    }
  }

  return works;
}

function countSelectionInput(
  selection: BulkAddSelectionPayload,
  resolvedCount = 0,
): number {
  if (selection.mode === "explicit") {
    return selection.selectedIds.length;
  }

  const fromTotal = Math.max(0, selection.totalCount - selection.excludedIds.length);
  if (fromTotal > 0) {
    return fromTotal;
  }

  return Math.max(0, resolvedCount - selection.excludedIds.length);
}

function assertExplicitSelection(
  selection: Extract<BulkAddSelectionPayload, { mode: "explicit" }>,
): void {
  const pseudoSelection = {
    mode: "explicit" as const,
    selectedIds: new Set(selection.selectedIds),
  };

  if (!hasSelection(pseudoSelection, selection.selectedIds.length)) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }
}

export function describeBulkAddRequestBody(
  body: unknown,
): BulkAddResolutionDebug | null {
  try {
    if (!body || typeof body !== "object") return null;
    const selection = parseSelectionPayload(body as Record<string, unknown>);
    return {
      selectionMode: selection.mode,
      receivedSelectedCount: countSelectionInput(selection),
      resolvedCount: 0,
      afterLimitCount: 0,
      appliedLimit: 0,
    };
  } catch {
    return null;
  }
}

export async function resolveBulkAddSelection(
  body: unknown,
): Promise<BulkAddResolutionResult> {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as Record<string, unknown>;
  const selection = parseSelectionPayload(payload);

  if (selection.mode === "explicit") {
    assertExplicitSelection(selection);
  }

  const works =
    selection.mode === "allMatching"
      ? await resolveAllMatchingWorks(selection)
      : await resolveExplicitWorks(selection);

  if (works.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  const receivedSelectedCount = countSelectionInput(selection, works.length);
  const selectedCount = works.length;
  const appliedLimit = resolveBulkAddLimit(payload.addLimit, selectedCount);
  const limited = works.slice(0, appliedLimit);

  if (limited.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
    throw new AddWorkValidationError(
      `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
    );
  }

  return {
    works: limited,
    appliedLimit,
    selectedCount,
    debug: {
      selectionMode: selection.mode,
      receivedSelectedCount,
      resolvedCount: works.length,
      afterLimitCount: limited.length,
      appliedLimit,
    },
  };
}
