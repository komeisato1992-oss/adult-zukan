import "server-only";

import {
  commitCatalogToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import { markImportCandidateAdded, markImportCandidatesAdded } from "@/lib/admin/import-candidates-store";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

export type AddWorkToCatalogResult =
  | { status: "added"; contentId: string }
  | { status: "duplicate"; contentId: string };

export type BulkAddWorksResult = {
  addedContentIds: string[];
  duplicateContentIds: string[];
  invalidContentIds: string[];
};

export class AddWorkValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AddWorkValidationError";
    this.status = status;
  }
}

function normalizeContentId(value: string): string {
  return value.trim().toLowerCase();
}

function prepareCatalogItem(item: DmmItem, contentId: string): DmmItem {
  const normalizedId = normalizeContentId(contentId);

  if (!normalizedId) {
    throw new AddWorkValidationError("content_id が不正です。");
  }

  if (normalizeContentId(item.content_id) !== normalizedId) {
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

export async function addWorkToCatalog(
  contentId: string,
  item: DmmItem,
): Promise<AddWorkToCatalogResult> {
  const preparedItem = prepareCatalogItem(item, contentId);
  const { items, sha } = await fetchCatalogFromGitHub();

  const exists = items.some(
    (entry) => normalizeContentId(entry.content_id) === preparedItem.content_id,
  );

  if (exists) {
    try {
      await markImportCandidateAdded(preparedItem.content_id);
    } catch {
      // 候補ステータス更新失敗は許容
    }

    return {
      status: "duplicate",
      contentId: preparedItem.content_id,
    };
  }

  const nextItems = [...items, preparedItem];
  await commitCatalogToGitHub(nextItems, sha, preparedItem.content_id);

  try {
    await markImportCandidateAdded(preparedItem.content_id);
  } catch {
    // カタログ追加は成功。候補ステータス更新失敗は後続操作で再同期可能。
  }

  return {
    status: "added",
    contentId: preparedItem.content_id,
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
    items.map((entry) => normalizeContentId(entry.content_id)),
  );

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
      invalidContentIds.push(contentId.trim().toLowerCase());
    }
  }

  if (preparedItems.length > 0) {
    await commitCatalogToGitHub(
      [...items, ...preparedItems],
      sha,
      `Add ${preparedItems.length} works via admin bulk import`,
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

  return { message: "追加に失敗しました。", status: 500 };
}
