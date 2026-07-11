import "server-only";

import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
} from "@/lib/admin/github-catalog";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { IMPORT_SIMPLE_ADD_MAX_RETRIES } from "@/lib/admin/import-constants";
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
  compareIndexUpdateStats,
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

function buildCatalogKeySet(items: DmmItem[]): Set<string> {
  return buildCatalogIdSet(items);
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
      console.warn("[add-selected-works] invalid work", {
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

export async function addSelectedWorksToCatalog(
  works: AddSelectedWorkInput[],
): Promise<AddSelectedWorksResult> {
  const selectedCount = works.length;
  let retryCount = 0;
  let retried = false;

  let catalogDuplicateCount = 0;
  let selectionDuplicateCount = 0;
  let invalidCount = 0;
  let addedContentIds: string[] = [];
  let indexUpdateStats: IndexUpdateStats | null = null;
  let committedToGitHub = false;

  while (retryCount <= IMPORT_SIMPLE_ADD_MAX_RETRIES) {
    const {
      items,
      envelope,
      raw,
    } = await fetchCatalogFromGitHub();

    const catalogKeys = buildCatalogKeySet(items);
    const classified = classifySelectedWorks(works, catalogKeys);

    catalogDuplicateCount = classified.catalogDuplicateContentIds.length;
    selectionDuplicateCount = classified.selectionDuplicateContentIds.length;
    invalidCount = classified.invalidContentIds.length;
    addedContentIds = classified.addedContentIds;

    if (classified.preparedItems.length === 0) {
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
    const mergedItems = dedupeCatalogWorks([
      ...classified.preparedItems,
      ...items.filter(
        (item) =>
          !preparedIds.has(normalizeCatalogContentId(item.content_id)),
      ),
    ]).items;

    try {
      const previousIndexes = rebuildAllIndexes(items);
      const nextIndexes = rebuildAllIndexes(mergedItems);
      indexUpdateStats = compareIndexUpdateStats(previousIndexes, nextIndexes);
      const indexFiles = serializeCatalogIndexes(nextIndexes);

      await commitCatalogBundleToGitHub(
        envelope,
        mergedItems,
        buildCommitMessage(classified.preparedItems.length),
        indexFiles,
        raw,
      );

      committedToGitHub = true;
      break;
    } catch (error) {
      if (
        error instanceof GitHubCatalogError &&
        (error.status === 409 || error.status === 422) &&
        retryCount < IMPORT_SIMPLE_ADD_MAX_RETRIES
      ) {
        retryCount += 1;
        retried = true;
        continue;
      }

      logCatalogSnapshotThrownError(error);

      if (error instanceof IndexRebuildError) {
        throw new AddSelectedWorksError(error.message, 500);
      }

      throw error;
    }
  }

  if (!committedToGitHub && addedContentIds.length > 0) {
    throw new GitHubCatalogError(
      "カタログ更新が競合しました。しばらく待ってから再度お試しください。",
      409,
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
} {
  if (error instanceof AddSelectedWorksError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof IndexRebuildError) {
    logCatalogSnapshotThrownError(error);
    return { message: error.message, status: 500 };
  }

  if (error instanceof GitHubCatalogError) {
    logCatalogSnapshotThrownError(error);
    return {
      message: "カタログの更新に失敗しました。追加は確定していません。",
      status: error.status,
    };
  }

  logCatalogSnapshotThrownError(error);
  console.error("[add-selected-works] unexpected error", error);

  return {
    message: "カタログの更新に失敗しました。追加は確定していません。",
    status: 500,
  };
}
