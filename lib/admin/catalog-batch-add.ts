import "server-only";

import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
  getBranchHeadSha,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { markImportCandidatesAdded } from "@/lib/admin/import-candidates-store";
import {
  buildWorkIdentityKeys,
  keysMatchAny,
} from "@/lib/admin/import-identity";
import { logImportBatchAdd } from "@/lib/admin/import-batch-log";
import type { ImportWorkAddStatus } from "@/lib/admin/import-batch-job";
import {
  IMPORT_BULK_ADD_INTERNAL_CHUNK,
  IMPORT_CATALOG_COMMIT_MAX_RETRIES,
} from "@/lib/admin/import-constants";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import {
  compareIndexUpdateStats,
  IndexRebuildError,
  rebuildAllIndexes,
  serializeCatalogIndexes,
  type IndexUpdateStats,
} from "@/lib/dmm/index-builders";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

export type CatalogBatchWorkStatus = {
  contentId: string;
  status: ImportWorkAddStatus;
  errorCode?: string;
};

export type CatalogBatchAddResult = {
  addedContentIds: string[];
  duplicateContentIds: string[];
  invalidContentIds: string[];
  failedContentIds: string[];
  workStatuses: CatalogBatchWorkStatus[];
  indexUpdateStats: IndexUpdateStats | null;
  committedToGitHub: boolean;
  commitCount: number;
  startSha: string | null;
  saveSha: string | null;
  retryCount: number;
};

function prepareCatalogItem(item: DmmItem, contentId: string): DmmItem {
  const normalizedId = normalizeCatalogContentId(contentId);

  if (!normalizedId) {
    throw new Error("INVALID_CONTENT_ID");
  }

  if (normalizeCatalogContentId(item.content_id) !== normalizedId) {
    throw new Error("CONTENT_ID_MISMATCH");
  }

  if (!isValidDmmListItem(item)) {
    throw new Error("INVALID_ITEM");
  }

  return {
    ...item,
    content_id: normalizedId,
    product_id: item.product_id?.trim() || normalizedId,
  };
}

function buildCatalogKeySet(items: DmmItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    for (const key of buildWorkIdentityKeys(item).allKeys) {
      keys.add(key);
    }
  }
  return keys;
}

function isDuplicateInCatalog(
  item: DmmItem,
  catalogKeys: Set<string>,
  batchKeys: Set<string>,
): boolean {
  const identity = buildWorkIdentityKeys(item);
  return (
    keysMatchAny(identity.allKeys, catalogKeys) ||
    keysMatchAny(identity.allKeys, batchKeys)
  );
}

function chunkWorks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildPopularCommitMessage(
  addedCount: number,
  startOffset: number,
): string {
  return `chore: add ${addedCount} popular FANZA works from offset ${startOffset}`;
}

async function commitMergedCatalog(
  preparedItems: DmmItem[],
  startOffset: number,
  startSha: string | null,
): Promise<{
  indexUpdateStats: IndexUpdateStats | null;
  saveSha: string | null;
  retryCount: number;
}> {
  let retryCount = 0;
  let saveSha: string | null = startSha;

  while (retryCount <= IMPORT_CATALOG_COMMIT_MAX_RETRIES) {
    const {
      items,
      envelope,
      raw,
      sha,
    } = await fetchCatalogFromGitHub();

    saveSha = sha;

    const catalogKeys = buildCatalogKeySet(items);
    const batchKeys = new Set<string>();
    const uniquePrepared: DmmItem[] = [];

    for (const item of preparedItems) {
      if (isDuplicateInCatalog(item, catalogKeys, batchKeys)) {
        continue;
      }

      for (const key of buildWorkIdentityKeys(item).allKeys) {
        batchKeys.add(key);
      }
      uniquePrepared.push(item);
    }

    if (uniquePrepared.length === 0) {
      return { indexUpdateStats: null, saveSha, retryCount };
    }

    const preparedIds = new Set(
      uniquePrepared.map((item) => normalizeCatalogContentId(item.content_id)),
    );
    const mergedItems = [
      ...uniquePrepared,
      ...items.filter(
        (item) =>
          !preparedIds.has(normalizeCatalogContentId(item.content_id)),
      ),
    ];

    let indexUpdateStats: IndexUpdateStats | null = null;
    try {
      const previousIndexes = rebuildAllIndexes(items);
      const nextIndexes = rebuildAllIndexes(mergedItems);
      indexUpdateStats = compareIndexUpdateStats(previousIndexes, nextIndexes);
      const indexFiles = serializeCatalogIndexes(nextIndexes);

      const headBeforeCommit = await getBranchHeadSha();
      await commitCatalogBundleToGitHub(
        envelope,
        mergedItems,
        buildPopularCommitMessage(uniquePrepared.length, startOffset),
        indexFiles,
        raw,
      );
      saveSha = headBeforeCommit;
      return { indexUpdateStats, saveSha, retryCount };
    } catch (error) {
      if (
        error instanceof GitHubCatalogError &&
        error.status === 409 &&
        retryCount < IMPORT_CATALOG_COMMIT_MAX_RETRIES
      ) {
        retryCount += 1;
        continue;
      }

      if (error instanceof IndexRebuildError) {
        throw error;
      }

      throw error;
    }
  }

  throw new GitHubCatalogError(
    "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
    409,
  );
}

export async function addWorksToCatalogInBatches(input: {
  works: Array<{ contentId: string; item: DmmItem }>;
  startOffset: number;
  processId: string;
}): Promise<CatalogBatchAddResult> {
  const startedAt = Date.now();
  const startSha = await getBranchHeadSha().catch(() => null);

  const initialCatalog = await fetchCatalogFromGitHub().catch(() => null);
  const catalogKeys = initialCatalog
    ? buildCatalogKeySet(initialCatalog.items)
    : new Set<string>();

  const workStatuses: CatalogBatchWorkStatus[] = input.works.map((work) => ({
    contentId: normalizeCatalogContentId(work.contentId),
    status: "pending",
  }));

  const preparedItems: DmmItem[] = [];
  const duplicateContentIds: string[] = [];
  const invalidContentIds: string[] = [];
  const failedContentIds: string[] = [];

  for (const work of input.works) {
    const statusEntry = workStatuses.find(
      (entry) =>
        entry.contentId === normalizeCatalogContentId(work.contentId),
    );

    if (!statusEntry) continue;
    statusEntry.status = "validating";

    const identity = buildWorkIdentityKeys(work.item);
    if (keysMatchAny(identity.allKeys, catalogKeys)) {
      duplicateContentIds.push(normalizeCatalogContentId(work.contentId));
      statusEntry.status = "skipped_existing";
      continue;
    }

    try {
      const prepared = prepareCatalogItem(work.item, work.contentId);
      preparedItems.push(prepared);
      statusEntry.status = "ready";
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "VALIDATION_FAILED";
      if (code === "INVALID_ITEM" || code === "INVALID_CONTENT_ID") {
        invalidContentIds.push(normalizeCatalogContentId(work.contentId));
        statusEntry.status = "skipped_invalid";
        statusEntry.errorCode = code;
      } else {
        failedContentIds.push(normalizeCatalogContentId(work.contentId));
        statusEntry.status = "failed";
        statusEntry.errorCode = code;
      }
    }
  }

  const chunks = chunkWorks(preparedItems, IMPORT_BULK_ADD_INTERNAL_CHUNK);
  const addedContentIds: string[] = [];
  let indexUpdateStats: IndexUpdateStats | null = null;
  let saveSha: string | null = startSha;
  let retryCount = 0;
  let commitCount = 0;

  try {
    for (const chunk of chunks) {
      const commitResult = await commitMergedCatalog(
        chunk,
        input.startOffset,
        saveSha,
      );
      retryCount = Math.max(retryCount, commitResult.retryCount);
      saveSha = commitResult.saveSha;
      indexUpdateStats = commitResult.indexUpdateStats;
      commitCount += 1;

      for (const item of chunk) {
        const id = normalizeCatalogContentId(item.content_id);
        addedContentIds.push(id);
        const statusEntry = workStatuses.find(
          (entry) => entry.contentId === id,
        );
        if (statusEntry) {
          statusEntry.status = "added";
        }
      }
    }
  } catch (error) {
    logCatalogSnapshotThrownError(error);

    for (const statusEntry of workStatuses) {
      if (statusEntry.status === "ready") {
        statusEntry.status = "failed";
        statusEntry.errorCode = "COMMIT_FAILED";
        failedContentIds.push(statusEntry.contentId);
      }
    }

    logImportBatchAdd({
      processId: input.processId,
      startOffset: input.startOffset,
      apiFetchedCount: 0,
      addTargetCount: input.works.length,
      addedCount: addedContentIds.length,
      skippedExistingCount: duplicateContentIds.length,
      excludedCount: invalidContentIds.length,
      failedCount: failedContentIds.length,
      startSha,
      saveSha,
      retryCount,
      durationMs: Date.now() - startedAt,
      errorCode: "COMMIT_FAILED",
    });

    throw error;
  }

  if (addedContentIds.length > 0) {
    try {
      await markImportCandidatesAdded(addedContentIds);
    } catch (error) {
      logCatalogSnapshotThrownError(error);
    }
  }

  logImportBatchAdd({
    processId: input.processId,
    startOffset: input.startOffset,
    apiFetchedCount: 0,
    addTargetCount: input.works.length,
    addedCount: addedContentIds.length,
    skippedExistingCount: duplicateContentIds.length,
    excludedCount: invalidContentIds.length,
    failedCount: failedContentIds.length,
    startSha,
    saveSha,
    retryCount,
    durationMs: Date.now() - startedAt,
    errorCode: null,
  });

  return {
    addedContentIds,
    duplicateContentIds,
    invalidContentIds,
    failedContentIds,
    workStatuses,
    indexUpdateStats,
    committedToGitHub: addedContentIds.length > 0,
    commitCount,
    startSha,
    saveSha,
    retryCount,
  };
}
