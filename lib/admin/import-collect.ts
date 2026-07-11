import "server-only";

import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import {
  acceptImportCollectItem,
  createEmptyExclusionStats,
  createImportCollectBlockContext,
  getExistingCatalogKeySet,
} from "@/lib/admin/import-collect-filters";
import {
  nextCollectPageHits,
  normalizeDmmOffset,
  planCollectPages,
} from "@/lib/admin/import-collect-params";
import {
  resetImportCollectProgress,
  startImportCollectProgress,
  updateImportCollectProgress,
} from "@/lib/admin/import-collect-progress";
import {
  buildFetchedHistoryKeySet,
  mergeItemsIntoFetchedHistory,
} from "@/lib/admin/import-fetched-history";
import {
  loadImportFetchedHistory,
  saveImportFetchedHistory,
} from "@/lib/admin/import-fetched-history-store";
import type {
  CollectImportCandidatesOptions,
  CollectImportCandidatesResult,
  ImportCollectionMode,
  ImportCollectRunStats,
} from "@/lib/admin/import-collect-types";
import {
  IMPORT_COLLECT_PAGE_SIZE,
  IMPORT_COLLECT_REQUEST_COUNT,
} from "@/lib/admin/import-constants";
import {
  loadImportCollectionState,
  saveImportCandidatesAndCollectionState,
} from "@/lib/admin/import-collection-state-store";
import type { ImportCollectionState } from "@/lib/admin/import-collection-state";
import { getPublishedWorkCount } from "@/lib/admin/stats";
import {
  getImportCandidateIdSet,
  loadImportCandidates,
} from "@/lib/admin/import-candidates-store";
import { storedRecordToListItem } from "@/lib/admin/import-candidates-visibility";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import type { DmmFetchOptions } from "@/lib/dmm/types";
import type { DmmItem } from "@/lib/dmm/types";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";

let collectInProgress = false;

export function isImportCollectInProgress(): boolean {
  return collectInProgress;
}

type FetchPageResult = {
  items: DmmItem[];
  totalCount: number | null;
  resultCount: number;
};

function getSortForMode(mode: ImportCollectionMode): DmmFetchOptions["sort"] {
  return mode === "popular" ? "rank" : "date";
}

function getSourceForMode(mode: ImportCollectionMode): string {
  if (mode === "popular") return "fanza-rank";
  return `fanza-${mode}`;
}

async function fetchCollectPage(
  offset: number,
  hits: number,
  sort: DmmFetchOptions["sort"],
): Promise<FetchPageResult> {
  const response = await fetchDmmItemList({
    sort,
    hits,
    offset,
    cache: "no-store",
  });

  return {
    items: response.result.items ?? [],
    totalCount: response.result.total_count ?? null,
    resultCount: response.result.result_count ?? response.result.items.length,
  };
}

function resolveStartOffset(
  mode: ImportCollectionMode,
  options: CollectImportCandidatesOptions,
  state: ImportCollectionState,
): number {
  if (mode === "new") return 1;

  const saved =
    mode === "popular"
      ? normalizeDmmOffset(state.popularOffset)
      : normalizeDmmOffset(state.pastOffset);

  return normalizeDmmOffset(options.startOffset ?? saved);
}

function buildCollectMessage(
  mode: ImportCollectionMode,
  runStats: ImportCollectRunStats,
  addedCount: number,
): string {
  const {
    requestedCount,
    apiFetchedCount,
    validCandidateCount,
    exclusionStats,
    startOffset,
    nextOffset,
    cycledPastCollection,
    currentCatalogCount,
    targetTotalCount,
    remainingToTarget,
  } = runStats;

  const duplicateInvalid =
    exclusionStats.duplicate +
    exclusionStats.invalid +
    exclusionStats.alreadyPending +
    exclusionStats.alreadyFetched;

  const modeLabel =
    mode === "popular"
      ? "人気順"
      : mode === "new"
        ? "新作"
        : "過去作品";

  const countLines = [
    `取得要求：${requestedCount.toLocaleString()}件`,
    `API取得：${apiFetchedCount.toLocaleString()}件`,
    `掲載済み：${exclusionStats.catalogPublished.toLocaleString()}件`,
    `取得済み履歴：${exclusionStats.alreadyFetched.toLocaleString()}件`,
    `追加済み候補：${exclusionStats.alreadyAdded.toLocaleString()}件`,
    `除外済み候補：${exclusionStats.alreadyExcluded.toLocaleString()}件`,
    `画像なし：${exclusionStats.noImage.toLocaleString()}件`,
    `重複・無効：${duplicateInvalid.toLocaleString()}件`,
    `有効候補：${validCandidateCount.toLocaleString()}件`,
  ];

  if (addedCount > 0) {
    countLines.push(`新規追加：${addedCount.toLocaleString()}件`);
  }

  if (mode === "popular") {
    countLines.push(
      `現在の総作品数：${currentCatalogCount.toLocaleString()}件`,
      `目標：${targetTotalCount.toLocaleString()}件`,
      `残り：${remainingToTarget.toLocaleString()}件`,
    );
  }

  const lines = [
    `${modeLabel}から${apiFetchedCount.toLocaleString()}件取得し、掲載済み・重複・無効を除いた${validCandidateCount.toLocaleString()}件を候補として処理しました。`,
    "",
    ...countLines,
  ];

  if (mode === "past" || mode === "popular") {
    lines.push(
      "",
      `今回の開始offset：${startOffset.toLocaleString()}`,
      `取得件数：${apiFetchedCount.toLocaleString()}`,
      `次回offset：${nextOffset.toLocaleString()}`,
    );
    if (cycledPastCollection) {
      lines.unshift("一覧を一周しました。", "");
    }
  }

  if (validCandidateCount === 0) {
    lines[0] =
      `${modeLabel}から${apiFetchedCount.toLocaleString()}件取得しましたが、有効な候補は見つかりませんでした。`;
  }

  return lines.join("\n");
}

function appendUniqueCandidates(
  existingRecords: StoredImportCandidate[],
  selected: StoredImportCandidate[],
): { addedCount: number; records: StoredImportCandidate[] } {
  const existingIds = getImportCandidateIdSet(existingRecords);
  const toAppend: StoredImportCandidate[] = [];

  for (const record of selected) {
    const id = record.content_id.trim().toLowerCase();
    if (!id || existingIds.has(id)) continue;
    existingIds.add(id);
    toAppend.push(record);
  }

  if (toAppend.length === 0) {
    return { addedCount: 0, records: existingRecords };
  }

  return {
    addedCount: toAppend.length,
    records: [...existingRecords, ...toAppend],
  };
}

async function buildSuccessResult(
  records: StoredImportCandidate[],
  message: string,
  runStats?: ImportCollectRunStats,
  addedCount = 0,
  collectedThisRun: StoredImportCandidate[] = [],
): Promise<CollectImportCandidatesResult> {
  const list = await buildImportCandidatesListFromRecords(records, {
    page: 1,
  });

  return {
    success: true,
    configured: true,
    collectedCount: addedCount,
    displayedCount: list.candidates.length,
    count: list.pagination.totalCount,
    candidates: list.candidates,
    collectedThisRun: collectedThisRun.map(storedRecordToListItem),
    message,
    summary: list.summary,
    pagination: list.pagination,
    runStats,
  };
}

async function buildEmptyConfiguredResult(
  message: string,
  existingRecords: StoredImportCandidate[],
): Promise<CollectImportCandidatesResult> {
  const list = await buildImportCandidatesListFromRecords(existingRecords, {
    page: 1,
  });

  return {
    success: true,
    configured: true,
    collectedCount: 0,
    displayedCount: list.candidates.length,
    count: list.pagination.totalCount,
    candidates: list.candidates,
    collectedThisRun: [],
    message,
    summary: list.summary,
    pagination: list.pagination,
  };
}

type CollectLoopResult = {
  selected: StoredImportCandidate[];
  fetchedItems: DmmItem[];
  apiFetchedCount: number;
  validatedCount: number;
  pagesFetched: number;
  currentOffset: number;
  cycledPastCollection: boolean;
  fetchCompleted: boolean;
  exclusionStats: ImportCollectRunStats["exclusionStats"];
};

async function runCollectLoop(input: {
  mode: ImportCollectionMode;
  requestCount: number;
  startOffset: number;
  pageSize: number;
  blockContext: ReturnType<typeof createImportCollectBlockContext>;
  onProgress?: CollectImportCandidatesOptions["onProgress"];
}): Promise<CollectLoopResult> {
  const {
    mode,
    requestCount,
    startOffset,
    pageSize,
    blockContext,
    onProgress,
  } = input;
  const sort = getSortForMode(mode);
  const exclusionStats = createEmptyExclusionStats();
  const selected: StoredImportCandidate[] = [];
  const fetchedItems: DmmItem[] = [];

  let apiFetchedCount = 0;
  let validatedCount = 0;
  let pagesFetched = 0;
  let currentOffset = startOffset;
  let cycledPastCollection = false;
  let lastTotalCount: number | null = null;
  let fetchCompleted = false;

  const plannedPages = planCollectPages(requestCount, pageSize);
  startImportCollectProgress({
    mode,
    requestedCount: requestCount,
    plannedPages,
    startOffset,
  });

  try {
    while (apiFetchedCount < requestCount && !fetchCompleted) {
      const hits = nextCollectPageHits(requestCount, apiFetchedCount, pageSize);
      let page: FetchPageResult;

      try {
        page = await fetchCollectPage(currentOffset, hits, sort);
      } catch (error) {
        if (pagesFetched === 0) {
          throw error;
        }
        throw new Error(
          `候補取得が途中で失敗しました（${pagesFetched}/${plannedPages}ページ完了）。offsetは更新していません。${
            error instanceof Error ? error.message : ""
          }`,
        );
      }

      pagesFetched += 1;
      const pageItems = page.items;
      apiFetchedCount += pageItems.length;
      validatedCount += pageItems.length;
      lastTotalCount = page.totalCount;
      fetchedItems.push(...pageItems);

      updateImportCollectProgress({
        apiFetchedCount,
        currentPage: pagesFetched,
      });

      if (pageItems.length === 0) {
        fetchCompleted = true;
        if (mode === "past" || mode === "popular") {
          cycledPastCollection = true;
          currentOffset = 1;
        }
        break;
      }

      for (const item of pageItems) {
        if (!acceptImportCollectItem(item, blockContext, exclusionStats)) {
          continue;
        }

        selected.push(
          dmmItemToStoredCandidate(item, getSourceForMode(mode), {
            collectionMode: mode,
          }),
        );
      }

      currentOffset += pageItems.length;

      await onProgress?.({
        currentPage: pagesFetched,
        plannedPages,
        currentOffset,
        apiFetchedCount,
        estimatedRemainingCount: Math.max(0, requestCount - apiFetchedCount),
      });

      if (apiFetchedCount >= requestCount) {
        fetchCompleted = true;
        break;
      }

      if (
        (mode === "past" || mode === "popular") &&
        lastTotalCount != null &&
        currentOffset > lastTotalCount
      ) {
        fetchCompleted = true;
        cycledPastCollection = true;
        currentOffset = 1;
        break;
      }

      if (pageItems.length < hits) {
        fetchCompleted = true;
        if (mode === "past" || mode === "popular") {
          cycledPastCollection = true;
          currentOffset = 1;
        }
        break;
      }
    }

    if (!fetchCompleted && apiFetchedCount < requestCount) {
      throw new Error(
        `候補取得が完了しませんでした（${apiFetchedCount}/${requestCount}件）。offsetは更新していません。`,
      );
    }

    return {
      selected,
      fetchedItems,
      apiFetchedCount,
      validatedCount,
      pagesFetched,
      currentOffset,
      cycledPastCollection,
      fetchCompleted,
      exclusionStats,
    };
  } finally {
    resetImportCollectProgress();
  }
}

function buildNextCollectionState(input: {
  mode: ImportCollectionMode;
  collectionState: ImportCollectionState;
  startOffset: number;
  nextOffset: number;
  pageSize: number;
  cycledPastCollection: boolean;
  targetTotalCount?: number;
}): ImportCollectionState {
  const now = new Date().toISOString();

  return {
    ...input.collectionState,
    pastOffset:
      input.mode === "past" ? input.nextOffset : input.collectionState.pastOffset,
    lastPastStartOffset:
      input.mode === "past"
        ? input.startOffset
        : input.collectionState.lastPastStartOffset,
    popularOffset:
      input.mode === "popular"
        ? input.nextOffset
        : input.collectionState.popularOffset,
    lastPopularStartOffset:
      input.mode === "popular"
        ? input.startOffset
        : input.collectionState.lastPopularStartOffset,
    targetTotalCount:
      input.targetTotalCount ?? input.collectionState.targetTotalCount,
    pageSize: input.pageSize,
    lastCollectedAt: now,
    lastNewCollectedAt:
      input.mode === "new" ? now : input.collectionState.lastNewCollectedAt,
    lastPastCollectedAt:
      input.mode === "past" ? now : input.collectionState.lastPastCollectedAt,
    lastPopularCollectedAt:
      input.mode === "popular" ? now : input.collectionState.lastPopularCollectedAt,
    lastMode: input.mode,
    cycleCount:
      (input.mode === "past" || input.mode === "popular") &&
      input.cycledPastCollection
        ? input.collectionState.cycleCount + 1
        : input.collectionState.cycleCount,
  };
}

export async function collectImportCandidates(
  options: CollectImportCandidatesOptions,
): Promise<CollectImportCandidatesResult> {
  const mode = options.mode;
  const requestCount = options.requestCount ?? IMPORT_COLLECT_REQUEST_COUNT;

  if (collectInProgress) {
    throw new Error("候補収集が既に実行中です。完了までお待ちください。");
  }

  collectInProgress = true;

  try {
    if (!isDmmConfigured()) {
      const emptyList = await buildImportCandidatesListFromRecords([]);
      return {
        success: false,
        configured: false,
        collectedCount: 0,
        displayedCount: 0,
        count: 0,
        message:
          "DMM API の認証情報が未設定です（DMM_API_ID / DMM_AFFILIATE_ID）。",
        candidates: [],
        collectedThisRun: [],
        summary: emptyList.summary,
        pagination: emptyList.pagination,
      };
    }

    const pageSize = IMPORT_COLLECT_PAGE_SIZE;
    const currentCatalogCount = await getPublishedWorkCount();
    const targetTotalCount =
      options.targetTotalCount ??
      (await loadImportCollectionState()).state.targetTotalCount;

    const catalogKeys = getExistingCatalogKeySet();
    const { records: existingRecords, sha: candidatesSha } =
      await loadImportCandidates();
    const { state: collectionState, sha: stateSha } =
      await loadImportCollectionState();
    const { history: fetchedHistory, sha: historySha } =
      await loadImportFetchedHistory();

    const startOffset = resolveStartOffset(mode, options, collectionState);
    const fetchedKeys = buildFetchedHistoryKeySet(fetchedHistory);

    const blockContext = createImportCollectBlockContext(
      catalogKeys,
      existingRecords,
      fetchedKeys,
    );

    const loopResult = await runCollectLoop({
      mode,
      requestCount,
      startOffset,
      pageSize,
      blockContext,
      onProgress: options.onProgress,
    });

    const nextOffset =
      mode === "past"
        ? loopResult.currentOffset
        : mode === "popular"
          ? loopResult.currentOffset
          : collectionState.pastOffset;

    const nextHistory = mergeItemsIntoFetchedHistory(
      {
        ...fetchedHistory,
        lastRunAt: new Date().toISOString(),
        lastApiFetchedCount: loopResult.apiFetchedCount,
      },
      loopResult.fetchedItems,
    );

    const runStats: ImportCollectRunStats = {
      mode,
      requestedCount: requestCount,
      apiFetchedCount: loopResult.apiFetchedCount,
      validatedCount: loopResult.validatedCount,
      validCandidateCount: loopResult.selected.length,
      pagesFetched: loopResult.pagesFetched,
      plannedPages: planCollectPages(requestCount, pageSize),
      addedCandidateCount: 0,
      exclusionStats: loopResult.exclusionStats,
      collectionState: {
        ...collectionState,
        pageSize,
      },
      startOffset,
      nextOffset,
      cycledPastCollection: loopResult.cycledPastCollection,
      fetchCompleted: loopResult.fetchCompleted,
      currentCatalogCount,
      targetTotalCount,
      remainingToTarget: Math.max(0, targetTotalCount - currentCatalogCount),
    };

    const nextState = buildNextCollectionState({
      mode,
      collectionState,
      startOffset,
      nextOffset,
      pageSize,
      cycledPastCollection: loopResult.cycledPastCollection,
      targetTotalCount,
    });

    if (loopResult.selected.length === 0) {
      await saveImportCandidatesAndCollectionState(
        existingRecords,
        nextState,
        candidatesSha,
        stateSha,
        mode === "popular"
          ? "Advance import popular collection offset via admin"
          : mode === "past"
            ? "Advance import past collection offset via admin"
            : "Run import new collection via admin",
      );
      await saveImportFetchedHistory(
        nextHistory,
        historySha,
        "Update import fetched history via admin",
      );

      runStats.collectionState = nextState;
      runStats.nextOffset = mode === "new" ? 1 : nextState.popularOffset;

      return {
        ...(await buildEmptyConfiguredResult(
          buildCollectMessage(mode, runStats, 0),
          existingRecords,
        )),
        runStats,
      };
    }

    const { addedCount, records } = appendUniqueCandidates(
      existingRecords,
      loopResult.selected,
    );

    await saveImportCandidatesAndCollectionState(
      records,
      nextState,
      candidatesSha,
      stateSha,
      `Collect ${addedCount} import candidates (${mode}) via admin`,
    );
    await saveImportFetchedHistory(
      {
        ...nextHistory,
        lastAddedCount: addedCount,
        lastSkippedExistingCount: loopResult.exclusionStats.catalogPublished,
        lastExcludedCount:
          loopResult.exclusionStats.invalid +
          loopResult.exclusionStats.duplicate,
        lastFailedCount: 0,
      },
      historySha,
      "Update import fetched history via admin",
    );

    runStats.addedCandidateCount = addedCount;
    runStats.collectionState = nextState;
    runStats.nextOffset =
      mode === "popular"
        ? nextState.popularOffset
        : mode === "past"
          ? nextState.pastOffset
          : 1;
    runStats.remainingToTarget = Math.max(
      0,
      targetTotalCount - currentCatalogCount,
    );

    return buildSuccessResult(
      records,
      buildCollectMessage(mode, runStats, addedCount),
      runStats,
      addedCount,
      loopResult.selected,
    );
  } finally {
    collectInProgress = false;
  }
}
