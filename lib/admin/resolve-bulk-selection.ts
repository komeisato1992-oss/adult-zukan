import "server-only";

import { resolveBulkAddLimit } from "@/lib/admin/bulk-add-limit";
import type { BulkAddWorkInput } from "@/lib/admin/bulk-add-request";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { parseImportCandidateFilters } from "@/lib/admin/import-candidate-filters";
import { validateBulkAddWorksInBatches } from "@/lib/admin/bulk-add-validate";
import { logBulkAddServerError } from "@/lib/admin/bulk-add-safe";
import {
  getFilteredImportCandidates,
  logImportCandidatePipelineStages,
  type ImportCandidatePipelineStages,
} from "@/lib/admin/import-candidates-query";
import { loadImportCandidates } from "@/lib/admin/import-candidates-store";
import {
  isPendingImportCandidate,
  storedRecordToListItem,
} from "@/lib/admin/import-candidates-visibility";
import { IMPORT_BULK_ADD_ABSOLUTE_MAX } from "@/lib/admin/import-constants";
import type { BulkAddSelectionPayload } from "@/lib/admin/import-selection";
import { hasSelection } from "@/lib/admin/import-selection";
import { AddWorkValidationError } from "@/lib/admin/add-work";

export type BulkAddResolutionDebug = {
  selectionMode: string;
  receivedSelectedCount: number;
  resolvedCount: number;
  afterLimitCount: number;
  appliedLimit: number;
  invalidCount?: number;
  validationBatches?: Array<{
    startIndex: number;
    endIndex: number;
    successCount: number;
    excludedCount: number;
    failedIds: string[];
  }>;
  pipeline?: ImportCandidatePipelineStages;
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
        filters: parseImportCandidateFilters(value.filters),
        sort:
          typeof value.sort === "string"
            ? (value.sort as ImportCandidateSortKey)
            : "seoScore-desc",
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
      filters: parseImportCandidateFilters(body.filters),
      sort:
        typeof body.sort === "string"
          ? (body.sort as ImportCandidateSortKey)
          : "seoScore-desc",
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

function buildBulkAddResolutionErrorMessage(
  selection: BulkAddSelectionPayload,
  stages: ImportCandidatePipelineStages,
  invalidCount: number,
): string {
  if (invalidCount > 0) {
    return "追加できる有効な候補がありませんでした。無効な候補を除外して再試行してください。";
  }

  if (selection.mode === "allMatching") {
    if (stages.rawCandidateCount === 0) {
      return "候補データの再取得結果が0件でした。候補一覧と一括追加APIのデータが一致していません。";
    }

    if (stages.afterQualityFilterCount === 0 && stages.filters.length > 0) {
      return "品質フィルター適用後の候補が0件でした。フィルター条件を見直してください。";
    }

    if (
      stages.afterQualityFilterCount > 0 &&
      stages.afterExcludedIdsCount === 0
    ) {
      return "除外ID適用後の候補が0件でした。選択状態を確認してください。";
    }

    if (
      stages.receivedTotalCount != null &&
      stages.receivedTotalCount > 0 &&
      stages.afterDeduplicationCount === 0
    ) {
      return "候補データの再取得結果が0件でした。候補一覧と一括追加APIのデータが一致していません。";
    }

    return "候補データの再取得結果が0件でした。候補一覧と一括追加APIのデータが一致していません。";
  }

  return "追加する作品が選択されていません。";
}

function formatPipelineDebugSuffix(stages: ImportCandidatePipelineStages): string {
  return [
    `元候補=${stages.rawCandidateCount}件`,
    `pending=${stages.pendingCandidateCount}件`,
    `品質フィルター後=${stages.afterQualityFilterCount}件`,
    `除外後=${stages.afterExcludedIdsCount}件`,
    `上限後=${stages.afterLimitCount}件`,
    `dataSource=${stages.dataSource}`,
    `parseShape=${stages.parseShape}`,
  ].join(" / ");
}

async function resolveAllMatchingWorks(
  selection: Extract<BulkAddSelectionPayload, { mode: "allMatching" }>,
  clientSampleIds: string[] = [],
): Promise<{
  works: BulkAddWorkInput[];
  stages: ImportCandidatePipelineStages;
}> {
  const filtered = await getFilteredImportCandidates({
    filters: selection.filters,
    sort: selection.sort,
    excludedIds: selection.excludedIds,
    receivedTotalCount: selection.totalCount,
    clientSampleIds,
  });

  logImportCandidatePipelineStages("[bulk-add allMatching]", filtered.stages);

  const works = filtered.candidates.map((candidate) => ({
    contentId: candidate.contentId,
    item: candidate.item,
  }));

  return { works, stages: filtered.stages };
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
    if (!isPendingImportCandidate(record)) continue;

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
  pipeline?: ImportCandidatePipelineStages,
): BulkAddResolutionDebug | null {
  try {
    if (!body || typeof body !== "object") return null;
    const selection = parseSelectionPayload(body as Record<string, unknown>);
    const payload = body as Record<string, unknown>;
    const receivedSelectedCount = countSelectionInput(selection);
    const resolvedCount = pipeline?.afterDeduplicationCount ?? 0;
    const appliedLimit = resolveBulkAddLimit(payload.addLimit, resolvedCount || receivedSelectedCount);

    return {
      selectionMode: selection.mode,
      receivedSelectedCount,
      resolvedCount,
      afterLimitCount: pipeline?.afterLimitCount ?? Math.min(appliedLimit, resolvedCount),
      appliedLimit,
      pipeline,
    };
  } catch {
    return null;
  }
}

export async function resolveBulkAddSelection(
  body: unknown,
): Promise<BulkAddResolutionResult> {
  console.log("[bulk-add] resolve selection start");

  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as Record<string, unknown>;
  const selection = parseSelectionPayload(payload);
  const clientSampleIds = Array.isArray(payload.clientSampleIds)
    ? payload.clientSampleIds.filter((id): id is string => typeof id === "string")
    : [];

  console.log("[bulk-add] selection parsed", {
    mode: selection.mode,
    receivedSelectedCount: countSelectionInput(selection),
    filters: selection.mode === "allMatching" ? selection.filters : [],
  });

  if (selection.mode === "explicit") {
    assertExplicitSelection(selection);
  }

  let pipeline: ImportCandidatePipelineStages | undefined;
  const rawWorks =
    selection.mode === "allMatching"
      ? await resolveAllMatchingWorks(selection, clientSampleIds).then((result) => {
          pipeline = result.stages;
          return result.works;
        })
      : await resolveExplicitWorks(selection);

  console.log("[bulk-add] candidates resolved", {
    resolvedCount: rawWorks.length,
    pipeline,
  });

  const validation = validateBulkAddWorksInBatches(rawWorks);
  const works = validation.valid;

  if (works.length === 0) {
    const firstInvalid = validation.invalid[0];
    logBulkAddServerError("resolveBulkAddSelection", new Error("no valid works"), {
      invalidCount: validation.invalid.length,
      firstInvalid,
      pipeline,
    });

    const stages =
      pipeline ??
      ({
        rawCandidateCount: 0,
        normalizedCandidateCount: 0,
        pendingCandidateCount: 0,
        afterStatusFilterCount: 0,
        afterQualityFilterCount: 0,
        afterSearchFilterCount: 0,
        afterExcludedIdsCount: 0,
        afterDeduplicationCount: 0,
        afterLimitCount: 0,
        filters: selection.mode === "allMatching" ? selection.filters : [],
        dataSource: "local",
        parseShape: "unknown",
        clientSampleIds,
        serverSampleIds: [],
      } satisfies ImportCandidatePipelineStages);

    const message = buildBulkAddResolutionErrorMessage(
      selection,
      stages,
      validation.invalid.length,
    );
    const suffix = formatPipelineDebugSuffix(stages);

    throw new AddWorkValidationError(`${message}\n${suffix}`, 400, {
      pipeline: stages,
    });
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

  if (pipeline) {
    pipeline.afterLimitCount = limited.length;
  }

  console.log("[bulk-add] resolve selection complete", {
    resolvedCount: works.length,
    invalidCount: validation.invalid.length,
    afterLimitCount: limited.length,
    pipeline,
  });

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
      invalidCount: validation.invalid.length,
      validationBatches: validation.batches,
      pipeline,
    },
  };
}
