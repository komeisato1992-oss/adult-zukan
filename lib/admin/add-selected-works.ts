import "server-only";

import {
  commitCatalogShardAppendToGitHub,
  fetchCatalogShardsFromGitHub,
} from "@/lib/admin/github-catalog-shards";
import { GitHubCatalogError } from "@/lib/admin/github-catalog";
import { getGitHubConfig } from "@/lib/admin/github-config";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { IMPORT_SIMPLE_ADD_MAX_RETRIES } from "@/lib/admin/import-constants";
import {
  AddSelectedWorksFailure,
  type AddSelectedWorksErrorDetails,
  type AddSelectedWorksPhase,
} from "@/lib/admin/add-selected-works-types";
import {
  buildCatalogIdSet,
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
import {
  appendWorksToCatalogShards,
  clearCatalogShardCache,
  getAllCatalogWorks,
  getCatalogManifest,
  getCatalogShard,
  writeCatalogShardsLocally,
  type CatalogManifest,
} from "@/lib/dmm/catalog-shards";
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
  sitemap?: import("@/lib/admin/seo-types").SitemapPostImportResult;
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
  sitemap?: AddSelectedWorksResult["sitemap"];
}): string {
  const { summary, indexUpdateStats, committedToGitHub, sitemap } = input;

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
    `受信：${summary.selectedCount}件`,
    `掲載済み除外：${summary.catalogDuplicateCount}件`,
    summary.selectionDuplicateCount > 0
      ? `選択内重複：${summary.selectionDuplicateCount}件`
      : null,
    `無効：${summary.invalidCount}件`,
    `追加成功：${summary.addedCount}件`,
    summary.updatedShardFiles && summary.updatedShardFiles.length > 0
      ? `更新shard：${summary.updatedShardFiles.join(", ")}`
      : null,
    summary.newShardFiles && summary.newShardFiles.length > 0
      ? `新規shard：${summary.newShardFiles.join(", ")}`
      : null,
    typeof summary.catalogCountAfter === "number"
      ? `総作品数：${summary.catalogCountAfter.toLocaleString()}件`
      : null,
  ].filter(Boolean) as string[];

  if (committedToGitHub || summary.githubCommitSucceeded) {
    lines.push("GitHub commit：成功");
  }

  if (indexUpdateStats && committedToGitHub) {
    lines.push("", formatIndexUpdateStats(indexUpdateStats));
  }

  if (sitemap) {
    lines.push(
      "",
      sitemap.sitemapUpdated
        ? "サイトマップ：更新済み"
        : "サイトマップ：更新に失敗（SEO管理画面から再実行してください）",
    );
    if (sitemap.googleSubmission.submitted) {
      lines.push("Google再送信：送信済み");
    } else if (sitemap.googleSubmission.reason === "recently-submitted") {
      lines.push("Google再送信：前回送信から30分以内のため省略");
    } else if (sitemap.googleSubmission.reason === "local-dry-run") {
      lines.push("Google再送信：ローカル環境のためdry-run");
    } else if (sitemap.sitemapUpdated) {
      lines.push("Google再送信：未送信");
    }
  }

  return lines.join("\n");
}

function buildSimplifiedIndexStats(addedCount: number): IndexUpdateStats {
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

function shouldWriteLocally(): boolean {
  if (process.env.CATALOG_ADD_LOCAL === "1") return true;
  return !getGitHubConfig();
}

function loadLocalCatalogState(): {
  manifest: CatalogManifest;
  items: DmmItem[];
  catalogKeys: Set<string>;
  lastShardWorks: DmmItem[];
} {
  const manifest = getCatalogManifest();
  if (!manifest) {
    throw new AddSelectedWorksError(
      "ローカル catalog shard（manifest.json）が見つかりません。先に移行してください。",
      500,
    );
  }

  const items = getAllCatalogWorks();
  const lastMeta = manifest.shards[manifest.shards.length - 1];
  const lastShardWorks = lastMeta ? getCatalogShard(lastMeta.file) : [];

  return {
    manifest,
    items,
    catalogKeys: buildCatalogIdSet(items),
    lastShardWorks,
  };
}

export async function addSelectedWorksToCatalog(
  works: AddSelectedWorkInput[],
): Promise<AddSelectedWorksResult> {
  const startedAt = Date.now();
  const selectedCount = works.length;
  let retryCount = 0;
  let retried = false;
  const localMode = shouldWriteLocally();

  logPhase("received", { receivedCount: selectedCount, localMode });

  let catalogDuplicateCount = 0;
  let selectionDuplicateCount = 0;
  let invalidCount = 0;
  let addedContentIds: string[] = [];
  let indexUpdateStats: IndexUpdateStats | null = null;
  let committedToGitHub = false;
  let validAddCount = 0;
  let finalCatalogCount = 0;
  let updatedShardFiles: string[] = [];
  let newShardFiles: string[] = [];

  while (retryCount <= IMPORT_SIMPLE_ADD_MAX_RETRIES) {
    let catalogCountBefore = 0;
    let catalogCountAfter = 0;

    try {
      console.time("[add-selected-api] fetch-catalog");
      const catalogState = localMode
        ? loadLocalCatalogState()
        : await fetchCatalogShardsFromGitHub();
      console.timeEnd("[add-selected-api] fetch-catalog");

      catalogCountBefore = catalogState.items.length;
      logPhase("fetch-catalog", {
        catalogCount: catalogState.items.length,
        shardCount: catalogState.manifest.shards.length,
        retryCount,
        localMode,
      });

      const classified = classifySelectedWorks(works, catalogState.catalogKeys);

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

        const summary: AddSelectedWorksSummary = {
          selectedCount,
          addedCount: 0,
          catalogDuplicateCount,
          selectionDuplicateCount,
          invalidCount,
          retried,
          catalogCountAfter: catalogState.items.length,
          githubCommitSucceeded: false,
        };

        return {
          summary,
          addedContentIds: [],
          indexUpdateStats: null,
          committedToGitHub: false,
          message: buildResultMessage({
            summary,
            indexUpdateStats: null,
            committedToGitHub: false,
          }),
        };
      }

      // 保存直前に再取得して競合を吸収
      console.time("[add-selected-api] precommit-refetch");
      const preCommitState = localMode
        ? loadLocalCatalogState()
        : await fetchCatalogShardsFromGitHub();
      console.timeEnd("[add-selected-api] precommit-refetch");

      const itemsToAdd = classified.preparedItems.filter(
        (item) => !workMatchesCatalogIds(item, preCommitState.catalogKeys),
      );

      if (itemsToAdd.length === 0) {
        const summary: AddSelectedWorksSummary = {
          selectedCount,
          addedCount: 0,
          catalogDuplicateCount:
            catalogDuplicateCount + classified.preparedItems.length,
          selectionDuplicateCount,
          invalidCount,
          retried,
          catalogCountAfter: preCommitState.items.length,
          githubCommitSucceeded: false,
        };

        return {
          summary,
          addedContentIds: [],
          indexUpdateStats: null,
          committedToGitHub: false,
          message: buildResultMessage({
            summary,
            indexUpdateStats: null,
            committedToGitHub: false,
          }),
        };
      }

      addedContentIds = itemsToAdd.map((item) => item.content_id);
      validAddCount = itemsToAdd.length;
      catalogCountAfter =
        preCommitState.manifest.totalCount + itemsToAdd.length;
      finalCatalogCount = catalogCountAfter;

      logPhase("merge-catalog", {
        catalogCountBefore: preCommitState.items.length,
        catalogCountAfter,
        validAddCount: itemsToAdd.length,
        mode: "shard-append",
      });

      console.time("[add-selected-api] rebuild-indexes");
      let indexFiles: Array<{ path: string; content: string }> = [];
      try {
        const mergedForIndex = [...itemsToAdd, ...preCommitState.items];
        const indexes = rebuildAllIndexes(mergedForIndex);
        // 巨大 search-index.json は GitHub へ書かない（実行時生成）
        indexFiles = serializeCatalogIndexes(indexes, {
          includeSearchIndex: false,
        });
        indexUpdateStats = buildSimplifiedIndexStats(itemsToAdd.length);
      } catch (error) {
        if (error instanceof IndexRebuildError) {
          fail("rebuild-indexes", error.message, 500, {
            receivedCount: selectedCount,
            validAddCount: itemsToAdd.length,
            catalogCountBefore: preCommitState.items.length,
            catalogCountAfter,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          });
        }
        throw error;
      }
      console.timeEnd("[add-selected-api] rebuild-indexes");

      console.time("[add-selected-api] github-commit");
      if (localMode) {
        const append = appendWorksToCatalogShards(
          preCommitState.manifest,
          preCommitState.lastShardWorks,
          itemsToAdd,
        );
        writeCatalogShardsLocally(
          append.manifest,
          append.changedShards.map((shard) => ({
            file: shard.file,
            works: shard.works,
          })),
        );
        updatedShardFiles = append.updatedShardFiles;
        newShardFiles = append.newShardFiles;
        finalCatalogCount = append.manifest.totalCount;
        committedToGitHub = false;
      } else {
        const commitResult = await commitCatalogShardAppendToGitHub({
          manifest: preCommitState.manifest,
          lastShardWorks: preCommitState.lastShardWorks,
          newWorks: itemsToAdd,
          commitLabel: buildCommitMessage(itemsToAdd.length),
          indexFiles,
        });
        updatedShardFiles = commitResult.append.updatedShardFiles;
        newShardFiles = commitResult.append.newShardFiles;
        finalCatalogCount = commitResult.totalCount;
        committedToGitHub = true;
      }
      console.timeEnd("[add-selected-api] github-commit");

      clearCatalogShardCache();

      logPhase("complete", {
        addedCount: itemsToAdd.length,
        catalogCountAfter: finalCatalogCount,
        updatedShardFiles,
        newShardFiles,
        elapsedMs: Date.now() - startedAt,
        retryCount,
        localMode,
      });
      break;
    } catch (error) {
      if (
        !localMode &&
        error instanceof GitHubCatalogError &&
        (error.status === 409 ||
          (error.status === 422 && error.phase === "update-ref")) &&
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

      // 巨大 blob 422 はリトライしない
      if (
        error instanceof GitHubCatalogError &&
        error.status === 422 &&
        error.githubMessage?.includes("too large")
      ) {
        fail(
          "github-commit",
          "変更shardの保存に失敗しました。巨大catalogへの書き戻しは行いません。",
          422,
          {
            status: error.status,
            githubMessage: error.githubMessage,
            githubDocumentationUrl: error.documentationUrl,
            githubPhase: String(error.phase ?? "create-catalog-blob"),
            receivedCount: selectedCount,
            validAddCount,
            catalogCountBefore,
            catalogCountAfter,
            elapsedMs: Date.now() - startedAt,
            retryCount,
          },
        );
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
        const githubPhase = error.phase ?? "github-commit";

        fail(
          githubPhase === "fetch-ref" || githubPhase === "fetch-commit"
            ? "fetch-catalog"
            : "github-commit",
          error.githubMessage
            ? `GitHubへのカタログ保存に失敗しました: ${error.message}`
            : "GitHubへのカタログ保存に失敗しました。作品は追加されていません。",
          error.status,
          {
            status: error.status,
            githubMessage: error.githubMessage,
            githubDocumentationUrl: error.documentationUrl,
            githubPhase: String(githubPhase),
            githubResponse: error.responseBody?.slice(0, 2000),
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

  if (!localMode && !committedToGitHub && addedContentIds.length > 0) {
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
    catalogCountAfter: finalCatalogCount > 0 ? finalCatalogCount : undefined,
    updatedShardFiles,
    newShardFiles,
    githubCommitSucceeded: committedToGitHub || localMode,
  };

  let sitemap: AddSelectedWorksResult["sitemap"];
  if (
    (committedToGitHub || localMode) &&
    addedContentIds.length > 0
  ) {
    try {
      const { handlePostImportSitemapUpdate } = await import(
        "@/lib/admin/sitemap-admin-service"
      );
      const sitemapResult = await handlePostImportSitemapUpdate();
      sitemap = {
        sitemapUpdated: sitemapResult.sitemapUpdated,
        sitemapError: sitemapResult.sitemapError,
        googleSubmission: {
          submitted: sitemapResult.googleSubmission.submitted,
          skipped: sitemapResult.googleSubmission.skipped,
          reason: sitemapResult.googleSubmission.reason,
          dryRun: sitemapResult.googleSubmission.dryRun,
        },
        refreshResults: sitemapResult.refreshResults
          .filter(
            (entry) =>
              entry.key === "works" || entry.key.startsWith("works-"),
          )
          .map((entry) => ({
            key: entry.key,
            urlCount: entry.urlCount,
            addedCount: entry.addedCount,
          })),
      };
    } catch (error) {
      sitemap = {
        sitemapUpdated: false,
        sitemapError:
          error instanceof Error
            ? error.message
            : "サイトマップ更新に失敗しました。",
        googleSubmission: {
          submitted: false,
          skipped: true,
          reason: "sitemap-update-failed",
        },
      };
    }
  }

  return {
    summary,
    addedContentIds,
    indexUpdateStats,
    committedToGitHub,
    sitemap,
    message: buildResultMessage({
      summary,
      indexUpdateStats,
      committedToGitHub: committedToGitHub || localMode,
      sitemap,
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
      message: error.message,
      status: error.status,
      phase: "github-commit",
      details: {
        status: error.status,
        githubMessage: error.githubMessage,
        githubDocumentationUrl: error.documentationUrl,
        githubPhase: error.phase,
        githubResponse: error.responseBody?.slice(0, 2000),
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
