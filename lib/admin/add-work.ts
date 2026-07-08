import "server-only";

import {
  commitCatalogToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { markImportCandidatesAdded } from "@/lib/admin/import-candidates-store";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import {
  summarizeImportSelection,
  type ImportSelectionSummary,
} from "@/lib/admin/import-quality";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

export type BulkAddWorksResult = {
  addedContentIds: string[];
  duplicateContentIds: string[];
  invalidContentIds: string[];
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

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AddWorkValidationError";
    this.status = status;
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
    } catch {
      invalidContentIds.push(normalizeCatalogContentId(contentId));
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
  if (works.length > IMPORT_BULK_ADD_MAX) {
    throw new AddWorkValidationError("1回で追加できるのは100件までです");
  }

  const { items } = await fetchCatalogFromGitHub();
  const existingIds = new Set(
    items.map((entry) => normalizeCatalogContentId(entry.content_id)),
  );

  const { preparedItems, duplicateContentIds, invalidContentIds } =
    classifyBulkWorks(works, existingIds);

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
  if (works.length > IMPORT_BULK_ADD_MAX) {
    throw new AddWorkValidationError("1回で追加できるのは100件までです");
  }

  if (works.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  const { items, sha } = await fetchCatalogFromGitHub();
  const existingIds = new Set(
    items.map((entry) => normalizeCatalogContentId(entry.content_id)),
  );

  const {
    preparedItems,
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
  } = classifyBulkWorks(works, existingIds);

  if (preparedItems.length > 0) {
    await commitCatalogToGitHub(
      [...items, ...preparedItems],
      sha,
      buildBulkCommitMessage(addedContentIds),
    );
  }

  const statusUpdateIds = [...addedContentIds, ...duplicateContentIds];
  if (statusUpdateIds.length > 0) {
    try {
      await markImportCandidatesAdded(statusUpdateIds);
    } catch {
      // カタログ追加は成功。候補ステータス更新失敗は後続操作で再同期可能。
    }
  }

  return {
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
  };
}

export function toAddWorkErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof AddWorkValidationError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof GitHubCatalogError) {
    return { message: error.message, status: error.status };
  }

  return { message: "追加に失敗しました", status: 500 };
}
