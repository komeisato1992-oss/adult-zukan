import "server-only";

import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { markImportCandidatesAdded } from "@/lib/admin/import-candidates-store";
import {
  getCandidateContentId,
  logBulkAddServerError,
} from "@/lib/admin/bulk-add-safe";
import { IMPORT_BULK_ADD_ABSOLUTE_MAX } from "@/lib/admin/import-constants";
import {
  summarizeImportSelection,
  type ImportSelectionSummary,
} from "@/lib/admin/import-quality";
import type { ImportCandidatePipelineStages } from "@/lib/admin/import-candidates-query";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import {
  compareIndexUpdateStats,
  formatIndexUpdateStats,
  IndexRebuildError,
  rebuildAllIndexes,
  serializeCatalogIndexes,
  type IndexUpdateStats,
} from "@/lib/dmm/index-builders";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

export type BulkAddWorksResult = {
  addedContentIds: string[];
  duplicateContentIds: string[];
  invalidContentIds: string[];
  rebuiltCatalog: boolean;
  indexUpdateStats: IndexUpdateStats | null;
  committedToGitHub: boolean;
};

export type BulkAddPreviewResult = {
  selectedCount: number;
  toAddCount: number;
  duplicateCount: number;
  invalidCount: number;
  qualitySummary: ImportSelectionSummary;
};

export class AddWorkValidationError extends Error {
  status: number;
  pipeline?: ImportCandidatePipelineStages;

  constructor(
    message: string,
    status = 400,
    options?: { pipeline?: ImportCandidatePipelineStages },
  ) {
    super(message);
    this.name = "AddWorkValidationError";
    this.status = status;
    this.pipeline = options?.pipeline;
  }
}

function prepareCatalogItem(item: DmmItem, contentId: string): DmmItem {
  const normalizedId = normalizeCatalogContentId(contentId);

  if (!normalizedId) {
    throw new AddWorkValidationError("content_id が不正です。");
  }

  if (normalizeCatalogContentId(item.content_id) !== normalizedId) {
    throw new AddWorkValidationError("content_id と作品データが一致しません。");
  }

  if (!isValidDmmListItem(item)) {
    throw new AddWorkValidationError("作品データがカタログ追加条件を満たしていません。");
  }

  return {
    ...item,
    content_id: normalizedId,
    product_id: item.product_id?.trim() || normalizedId,
  };
}

function classifyBulkWorks(
  works: Array<{ contentId: string; item: DmmItem }>,
  existingIds: Set<string>,
): {
  preparedItems: DmmItem[];
  addedContentIds: string[];
  duplicateContentIds: string[];
  invalidContentIds: string[];
} {
  const preparedItems: DmmItem[] = [];
  const addedContentIds: string[] = [];
  const duplicateContentIds: string[] = [];
  const invalidContentIds: string[] = [];
  const batchIds = new Set<string>();

  for (const { contentId, item } of works) {
    try {
      const prepared = prepareCatalogItem(item, contentId);

      if (
        existingIds.has(prepared.content_id) ||
        batchIds.has(prepared.content_id)
      ) {
        duplicateContentIds.push(prepared.content_id);
        continue;
      }

      batchIds.add(prepared.content_id);
      preparedItems.push(prepared);
      addedContentIds.push(prepared.content_id);
    } catch (error) {
      const normalizedId = normalizeCatalogContentId(contentId);
      invalidContentIds.push(normalizedId);
      console.warn("[bulk-add] invalid candidate", {
        contentId: normalizedId || getCandidateContentId(item),
        productId: item.product_id,
        title: item.title,
        reason: error instanceof Error ? error.message : String(error),
        stage: "prepareCatalogItem",
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    preparedItems,
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
  };
}

function buildBulkCommitMessage(addedContentIds: string[]): string {
  if (addedContentIds.length === 0) {
    return "Add works from admin import";
  }

  if (addedContentIds.length <= 3) {
    return `Add works: ${addedContentIds.join(", ")}`;
  }

  return `Add ${addedContentIds.length} works from admin import`;
}

export async function previewBulkAddWorks(
  works: Array<{ contentId: string; item: DmmItem }>,
): Promise<BulkAddPreviewResult> {
  console.log("[bulk-add] preview start", { workCount: works.length });

  if (works.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
    throw new AddWorkValidationError(
      `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
    );
  }

  const { items } = await fetchCatalogFromGitHub();
  console.log("[bulk-add] catalog loaded", { catalogCount: items.length });

  const existingIds = new Set(
    items.map((entry) => normalizeCatalogContentId(entry.content_id)),
  );

  const { preparedItems, duplicateContentIds, invalidContentIds } =
    classifyBulkWorks(works, existingIds);

  console.log("[bulk-add] preview classified", {
    preparedCount: preparedItems.length,
    duplicateCount: duplicateContentIds.length,
    invalidCount: invalidContentIds.length,
  });

  return {
    selectedCount: works.length,
    toAddCount: preparedItems.length,
    duplicateCount: duplicateContentIds.length,
    invalidCount: invalidContentIds.length,
    qualitySummary: summarizeImportSelection(preparedItems),
  };
}

export async function addWorksToCatalog(
  works: Array<{ contentId: string; item: DmmItem }>,
): Promise<BulkAddWorksResult> {
  if (works.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
    throw new AddWorkValidationError(
      `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
    );
  }

  if (works.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  // 形式不正でも止めず、空配列 or 復旧形式で続行する
  const {
    items,
    envelope,
    raw,
    rebuilt,
  } = await fetchCatalogFromGitHub();

  const existingIds = new Set(
    items.map((entry) => normalizeCatalogContentId(entry.content_id)),
  );

  const {
    preparedItems,
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
  } = classifyBulkWorks(works, existingIds);

  let indexUpdateStats: IndexUpdateStats | null = null;
  let committedToGitHub = false;

  if (preparedItems.length > 0) {
    // 新規追加を先頭に置く（一覧・検索は catalog-snapshot 全件を参照）。
    // TODO: 将来は data/dmm/search-index.json をフロントが直接参照する案も検討。
    const preparedIds = new Set(
      preparedItems.map((item) => normalizeCatalogContentId(item.content_id)),
    );
    const mergedItems = [
      ...preparedItems,
      ...items.filter(
        (item) => !preparedIds.has(normalizeCatalogContentId(item.content_id)),
      ),
    ];

    let previousIndexes;
    let nextIndexes;
    try {
      previousIndexes = rebuildAllIndexes(items);
      nextIndexes = rebuildAllIndexes(mergedItems);
      indexUpdateStats = compareIndexUpdateStats(previousIndexes, nextIndexes);
    } catch (error) {
      if (error instanceof IndexRebuildError) {
        throw new AddWorkValidationError(error.message, 500);
      }
      throw error;
    }

    const indexFiles = serializeCatalogIndexes(nextIndexes);

    try {
      await commitCatalogBundleToGitHub(
        envelope,
        mergedItems,
        buildBulkCommitMessage(addedContentIds),
        indexFiles,
        raw,
      );
      committedToGitHub = true;
    } catch (error) {
      logCatalogSnapshotThrownError(error);
      throw error;
    }
  }

  const statusUpdateIds = [...addedContentIds, ...duplicateContentIds];
  if (statusUpdateIds.length > 0) {
    try {
      await markImportCandidatesAdded(statusUpdateIds);
    } catch (error) {
      logCatalogSnapshotThrownError(error);
      console.warn("Failed to mark import candidates as added:", error);
    }
  }

  return {
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
    rebuiltCatalog: rebuilt,
    indexUpdateStats,
    committedToGitHub,
  };
}

export function toAddWorkErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  logBulkAddServerError("toAddWorkErrorMessage", error);

  if (error instanceof AddWorkValidationError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof IndexRebuildError) {
    logCatalogSnapshotThrownError(error);
    return { message: error.message, status: 500 };
  }

  if (error instanceof GitHubCatalogError) {
    logCatalogSnapshotThrownError(error);
    return {
      message: `${error.message} 追加に失敗しました。consoleに catalog-snapshot debug を出力しています。`,
      status: error.status,
    };
  }

  logCatalogSnapshotThrownError(error);
  return {
    message:
      "追加に失敗しました。consoleに catalog-snapshot debug を出力しています。",
    status: 500,
  };
}
