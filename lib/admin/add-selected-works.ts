import "server-only";

import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { IMPORT_SIMPLE_ADD_MAX_RETRIES } from "@/lib/admin/import-constants";
import {
  AddSelectedWorksFailure,
  type AddSelectedWorksErrorDetails,
  type AddSelectedWorksPhase,
} from "@/lib/admin/add-selected-works-types";
import {
  buildCatalogIdSet,
  dedupeCatalogWorks,
  workMatchesCatalogIds,
} from "@/lib/dmm/catalog-dedupe";
import type {
  AddSelectedWorkInput,
  AddSelectedWorksSummary,
} from "@/lib/admin/import-simple-types";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import {
  formatIndexUpdateStats,
  IndexRebuildError,
  rebuildAllIndexes,
  serializeCatalogIndexes,
  type IndexUpdateStats,
} from "@/lib/dmm/index-builders";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import { enrichCatalogItemMetadata } from "@/lib/dmm/catalog-metadata";
import type { DmmItem } from "@/lib/dmm/types";

export class AddSelectedWorksError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AddSelectedWorksError";
    this.status = status;
  }
}

export type AddSelectedWorksResult = {
  summary: AddSelectedWorksSummary;
  addedContentIds: string[];
  indexUpdateStats: IndexUpdateStats | null;
  committedToGitHub: boolean;
  message: string;
};

function logPhase(
  phase: AddSelectedWorksPhase,
  data: Record<string, unknown>,
): void {
  console.log(`[add-selected-api] ${phase}`, data);
}

function fail(
  phase: AddSelectedWorksPhase,
  message: string,
  status = 500,
  details?: AddSelectedWorksErrorDetails,
): never {
  console.error("[add-selected-api] failed", {
    phase,
    message,
    status,
    details,
  });
  throw new AddSelectedWorksFailure(phase, message, status, details);
}

function prepareCatalogItem(
  item: DmmItem,
  contentId: string,
  metadata?: { sourcePopularityRank?: number | null },
): DmmItem {
  const normalizedId = normalizeCatalogContentId(contentId);

  if (!normalizedId) {
    throw new AddSelectedWorksError("content_id が不正です。");
  }

  if (normalizeCatalogContentId(item.content_id) !== normalizedId) {
    throw new AddSelectedWorksError("content_id と作品データが一致しません。");
  }

  if (!isValidDmmListItem(item)) {
    throw new AddSelectedWorksError(
      "作品データがカタログ追加条件を満たしていません。",
    );
  }

  return enrichCatalogItemMetadata(
    {
      ...item,
      content_id: normalizedId,
      product_id: item.product_id?.trim() || normalizedId,
    },
    {
      sourcePopularityRank: metadata?.sourcePopularityRank,
    },
  );
}

function parseWorkEntries(entries: unknown): AddSelectedWorkInput[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AddSelectedWorksError("追加する作品が選択されていません。");
  }

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new AddSelectedWorksError(`作品データ(${index + 1}件目)が不正です。`);
    }

    const record = entry as {
      contentId?: string;
      item?: DmmItem;
      sourcePopularityRank?: number | null;
    };

    const contentId = record.contentId?.trim();
    const item = record.item;

    if (!contentId || !item || typeof item !== "object") {
      throw new AddSelectedWorksError(`作品データ(${index + 1}件目)が不正です。`);
    }

    return {
      contentId,
      item,
      sourcePopularityRank: record.sourcePopularityRank ?? null,
    };
  });
}

export function parseAddSelectedWorksRequest(body: unknown): AddSelectedWorkInput[] {
  if (!body || typeof body !== "object") {
    throw new AddSelectedWorksError("リクエスト形式が不正です。");
  }

  const payload = body as { works?: unknown };
  const works = parseWorkEntries(payload.works);

  if (works.length > 500) {
    throw new AddSelectedWorksError("1回で追加できるのは500件までです。");
  }

  return works;
}

function classifySelectedWorks(
  works: AddSelectedWorkInput[],
  catalogKeys: Set<string>,
): {
  preparedItems: DmmItem[];
  addedContentIds: string[];
  catalogDuplicateContentIds: string[];
  selectionDuplicateContentIds: string[];
  invalidContentIds: string[];
} {
  const preparedItems: DmmItem[] = [];
  const addedContentIds: string[] = [];
  const catalogDuplicateContentIds: string[] = [];
  const selectionDuplicateContentIds: string[] = [];
  const invalidContentIds: string[] = [];
  const batchKeys = new Set<string>();

  for (const work of works) {
    const normalizedId = normalizeCatalogContentId(work.contentId);

    if (workMatchesCatalogIds(work.item, catalogKeys)) {
      catalogDuplicateContentIds.push(normalizedId || work.contentId);
      continue;
    }

    if (workMatchesCatalogIds(work.item, batchKeys)) {
      selectionDuplicateContentIds.push(normalizedId || work.contentId);
      continue;
    }

    try {
      const prepared = prepareCatalogItem(work.item, work.contentId, {
        sourcePopularityRank: work.sourcePopularityRank,
      });

      for (const key of buildCatalogIdSet([prepared])) {
        batchKeys.add(key);
      }

      preparedItems.push(prepared);
      addedContentIds.push(prepared.content_id);
    } catch (error) {
      invalidContentIds.push(
        normalizeImportContentId(work.contentId) || work.contentId,
      );
      console.warn("[add-selected-api] invalid work", {
        contentId: work.contentId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    preparedItems,
    addedContentIds,
    catalogDuplicateContentIds,
    selectionDuplicateContentIds,
    invalidContentIds,
  };
}

function buildCommitMessage(addedCount: number): string {
  if (addedCount <= 0) return "Add works from admin import";
  return `Add ${addedCount} works from admin import`;
}

function buildResultMessage(input: {
  summary: AddSelectedWorksSummary;
  indexUpdateStats: IndexUpdateStats | null;
  committedToGitHub: boolean;
}): string {
  const { summary, indexUpdateStats, committedToGitHub } = input;

  if (summary.addedCount === 0) {
    if (
      summary.catalogDuplicateCount > 0 &&
      summary.selectionDuplicateCount === 0 &&
      summary.invalidCount === 0
    ) {
      return "選択した作品はすべて掲載済みでした。";
    }

    return [
      "追加できる作品がありませんでした。",
      summary.catalogDuplicateCount > 0
        ? `追加直前に掲載済み：${summary.catalogDuplicateCount}件`
        : null,
      summary.selectionDuplicateCount > 0
        ? `選択内重複：${summary.selectionDuplicateCount}件`
        : null,
      summary.invalidCount > 0 ? `無効：${summary.invalidCount}件` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = [
    summary.retried
      ? "最新カタログと再照合して追加しました。"
      : `${summary.addedCount}件を追加しました。`,
    `選択：${summary.selectedCount}件`,
    `追加成功：${summary.addedCount}件`,
    summary.catalogDuplicateCount > 0
      ? `追加直前に掲載済み：${summary.catalogDuplicateCount}件`
      : null,
    summary.selectionDuplicateCount > 0
      ? `選択内重複：${summary.selectionDuplicateCount}件`
      : null,
    summary.invalidCount > 0 ? `無効：${summary.invalidCount}件` : null,
  ].filter(Boolean) as string[];

  if (indexUpdateStats && committedToGitHub) {
    lines.push("", formatIndexUpdateStats(indexUpdateStats));
    lines.push("", "GitHubへ1回commitしました。");
  } else if (committedToGitHub) {
    lines.push("", "GitHubへ1回commitしました。");
  }

  return lines.join("\n");
}

function buildSimplifiedIndexStats(
  addedCount: number,
): IndexUpdateStats {
  return {
    actressesAdded: addedCount,
    makersAdded: addedCount,
    labelsAdded: addedCount,
    seriesAdded: addedCount,
    genresAdded: addedCount,
    searchIndexUpdated: true,
    rankingUpdated: true,
  };
}

export async function addSelectedWorksToCatalog(
  works: AddSelectedWorkInput[],
): Promise<AddSelectedWorksResult> {
  const startedAt = Date.now();
  const selectedCount = works.length;
  let retryCount = 0;
  let retried = false;

  logPhase("received", { receivedCount: selectedCount });

  let catalogDuplicateCount = 0;
  let selectionDuplicateCount = 0;
  let invalidCount = 0;
  let addedContentIds: string[] = [];
  let indexUpdateStats: IndexUpdateStats | null = null;
  let committedToGitHub = false;
  let validAddCount = 0;

  while (retryCount <= IMPORT_SIMPLE_ADD_MAX_RETRIES) {
    let catalogCountBefore = 0;
    let catalogCountAfter = 0;

    try {
      console.time("[add-selected-api] fetch-catalog");
      let catalogHandle;
      try {
        catalogHandle = await fetchCatalogFromGitHub();
      } catch (error) {
        if (error instanceof GitHubCatalogError) {
          fail(
            "fetch-catalog",
            error.githubMessage ??
              "GitHubから最新カタログを取得できませんでした。",
            error.status,
            {
              status: error.status,
              githubMessage: error.githubMessage,
              githubDocumentationUrl: error.documentationUrl,
              receivedCount: selectedCount,
              elapsedMs: Date.now() - startedAt,
              retryCount,
            },
          );
        }
        throw error;
      }
      const {
        items,
        envelope,
        raw,
        sha,
      } = catalogHandle;
      console.timeEnd("[add-selected-api] fetch-catalog");

      catalogCountBefore = items.length;
      logPhase("fetch-catalog", {
        catalogCount: items.length,
        sha,
        retryCount,
      });

      const catalogKeys = buildCatalogIdSet(items);
      const classified = classifySelectedWorks(works, catalogKeys);

      catalogDuplicateCount = classified.catalogDuplicateContentIds.length;
      selectionDuplicateCount = classified.selectionDuplicateContentIds.length;
      invalidCount = classified.invalidContentIds.length;
      addedContentIds = classified.addedContentIds;
      validAddCount = classified.preparedItems.length;

      logPhase("deduplicate", {
        receivedCount: selectedCount,
        catalogDuplicateCount,
        selectionDuplicateCount,
        invalidCount,
        validAddCount: classified.preparedItems.length,
      });

      if (classified.preparedItems.length === 0) {
        logPhase("complete", {
          addedCount: 0,
          elapsedMs: Date.now() - startedAt,
        });

        return {
          summary: {
            selectedCount,
            addedCount: 0,
            catalogDuplicateCount,
            selectionDuplicateCount,
            invalidCount,
            retried,
          },
          addedContentIds: [],
          indexUpdateStats: null,
          committedToGitHub: false,
          message: buildResultMessage({
            summary: {
              selectedCount,
              addedCount: 0,
              catalogDuplicateCount,
              selectionDuplicateCount,
              invalidCount,
              retried,
            },
            indexUpdateStats: null,
            committedToGitHub: false,
          }),
        };
      }

      const preparedIds = new Set(
        classified.preparedItems.map((item) =>
          normalizeCatalogContentId(item.content_id),
        ),
      );

      console.time("[add-selected-api] merge-catalog");
      const mergedItems = dedupeCatalogWorks([
        ...classified.preparedItems,
        ...items.filter(
          (item) =>
            !preparedIds.has(normalizeCatalogContentId(item.content_id)),
        ),
      ]).items;
      console.timeEnd("[add-selected-api] merge-catalog");

      catalogCountAfter = mergedItems.length;
      logPhase("merge-catalog", {
        catalogCountBefore,
        catalogCountAfter,
        validAddCount: classified.preparedItems.length,
      });

      console.time("[add-selected-api] rebuild-indexes");
      let nextIndexes;
      try {
        nextIndexes = rebuildAllIndexes(mergedItems);
      } catch (error) {
        if (error instanceof IndexRebuildError) {
          fail("rebuild-indexes", error.message, 500, {
            receivedCount: selectedCount,
            validAddCount: classified.preparedItems.length,
            catalogCountBefore,
            catalogCountAfter,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          });
        }
        throw error;
      }
      console.timeEnd("[add-selected-api] rebuild-indexes");

      indexUpdateStats = buildSimplifiedIndexStats(
        classified.preparedItems.length,
      );
      const indexFiles = serializeCatalogIndexes(nextIndexes);

      logPhase("serialize-catalog", {
        indexFileCount: indexFiles.length,
        indexByteLengths: indexFiles.map((file) => ({
          path: file.path,
          bytes: Buffer.byteLength(file.content, "utf8"),
        })),
      });

      console.time("[add-selected-api] github-commit");
      await commitCatalogBundleToGitHub(
        envelope,
        mergedItems,
        buildCommitMessage(classified.preparedItems.length),
        indexFiles,
        raw,
      );
      console.timeEnd("[add-selected-api] github-commit");

      committedToGitHub = true;
      logPhase("complete", {
        addedCount: classified.preparedItems.length,
        catalogCountAfter,
        elapsedMs: Date.now() - startedAt,
        retryCount,
      });
      break;
    } catch (error) {
      if (
        error instanceof GitHubCatalogError &&
        (error.status === 409 || error.status === 422) &&
        retryCount < IMPORT_SIMPLE_ADD_MAX_RETRIES
      ) {
        retryCount += 1;
        retried = true;
        console.warn("[add-selected-api] retry after github conflict", {
          retryCount,
          status: error.status,
          githubMessage: error.githubMessage,
        });
        continue;
      }

      logCatalogSnapshotThrownError(error);

      if (error instanceof AddSelectedWorksFailure) {
        throw error;
      }

      if (error instanceof IndexRebuildError) {
        fail("rebuild-indexes", error.message, 500, {
          receivedCount: selectedCount,
          catalogCountBefore,
          catalogCountAfter,
          elapsedMs: Date.now() - startedAt,
          retryCount,
        });
      }

      if (error instanceof GitHubCatalogError) {
        const githubPhase =
          error.phase === "create-blob" ||
          error.phase === "create-tree" ||
          error.phase === "create-commit" ||
          error.phase === "update-ref" ||
          error.phase === "get-branch-head"
            ? "github-commit"
            : "fetch-catalog";

        fail(
          githubPhase,
          error.githubMessage
            ? `GitHubへのカタログ保存に失敗しました: ${error.githubMessage}`
            : "GitHubへのカタログ保存に失敗しました。作品は追加されていません。",
          error.status,
          {
            status: error.status,
            githubMessage: error.githubMessage,
            githubDocumentationUrl: error.documentationUrl,
            receivedCount: selectedCount,
            validAddCount,
            catalogCountBefore,
            catalogCountAfter,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          },
        );
      }

      fail(
        "github-commit",
        "カタログの更新に失敗しました。追加は確定していません。",
        500,
        {
          receivedCount: selectedCount,
          validAddCount: validAddCount || addedContentIds.length,
          elapsedMs: Date.now() - startedAt,
          retryCount,
        },
      );
    }
  }

  if (!committedToGitHub && addedContentIds.length > 0) {
    fail(
      "github-commit",
      "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
      409,
      {
        receivedCount: selectedCount,
        validAddCount: addedContentIds.length,
        elapsedMs: Date.now() - startedAt,
        retryCount,
      },
    );
  }

  const summary: AddSelectedWorksSummary = {
    selectedCount,
    addedCount: addedContentIds.length,
    catalogDuplicateCount,
    selectionDuplicateCount,
    invalidCount,
    retried,
  };

  return {
    summary,
    addedContentIds,
    indexUpdateStats,
    committedToGitHub,
    message: buildResultMessage({
      summary,
      indexUpdateStats,
      committedToGitHub,
    }),
  };
}

export function toAddSelectedWorksErrorMessage(error: unknown): {
  message: string;
  status: number;
  phase?: AddSelectedWorksPhase;
  details?: AddSelectedWorksErrorDetails;
} {
  if (error instanceof AddSelectedWorksFailure) {
    return {
      message: error.message,
      status: error.status,
      phase: error.phase,
      details: error.details,
    };
  }

  if (error instanceof AddSelectedWorksError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof IndexRebuildError) {
    logCatalogSnapshotThrownError(error);
    return {
      message: error.message,
      status: 500,
      phase: "rebuild-indexes",
    };
  }

  if (error instanceof GitHubCatalogError) {
    logCatalogSnapshotThrownError(error);
    return {
      message: "GitHubへのカタログ保存に失敗しました。作品は追加されていません。",
      status: error.status,
      phase: "github-commit",
      details: {
        status: error.status,
        githubMessage: error.githubMessage,
        githubDocumentationUrl: error.documentationUrl,
      },
    };
  }

  logCatalogSnapshotThrownError(error);
  console.error("[add-selected-api] unexpected error", error);

  return {
    message: "カタログの更新に失敗しました。追加は確定していません。",
    status: 500,
    phase: "github-commit",
  };
}
