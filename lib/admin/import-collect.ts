import "server-only";

import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import {
  acceptImportCollectItem,
  createEmptyExclusionStats,
  createImportCollectBlockContext,
  getExistingCatalogIdSets,
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
import {
  getImportCandidateIdSet,
  loadImportCandidates,
} from "@/lib/admin/import-candidates-store";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
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

async function fetchCollectPage(
  offset: number,
  hits: number,
): Promise<FetchPageResult> {
  const response = await fetchDmmItemList({
    sort: "date",
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
    startPastOffset,
    nextPastOffset,
    cycledPastCollection,
  } = runStats;

  const duplicateInvalid =
    exclusionStats.duplicate +
    exclusionStats.invalid +
    exclusionStats.alreadyPending;

  const countLines = [
    `取得要求：${requestedCount.toLocaleString()}件`,
    `API取得：${apiFetchedCount.toLocaleString()}件`,
    `掲載済み：${exclusionStats.catalogPublished.toLocaleString()}件`,
    `追加済み候補：${exclusionStats.alreadyAdded.toLocaleString()}件`,
    `除外済み候補：${exclusionStats.alreadyExcluded.toLocaleString()}件`,
    `画像なし：${exclusionStats.noImage.toLocaleString()}件`,
    `重複・無効：${duplicateInvalid.toLocaleString()}件`,
    `有効候補：${validCandidateCount.toLocaleString()}件`,
  ];

  if (addedCount > 0) {
    countLines.push(`新規追加：${addedCount.toLocaleString()}件`);
  }

  const lines = [
    mode === "new"
      ? `新作を${apiFetchedCount.toLocaleString()}件取得し、掲載済み・重複・無効を除いた${validCandidateCount.toLocaleString()}件を候補として処理しました。`
      : `過去作品を${apiFetchedCount.toLocaleString()}件取得し、掲載済み・重複・無効を除いた${validCandidateCount.toLocaleString()}件を候補として処理しました。`,
    "",
    ...countLines,
  ];

  if (mode === "past") {
    lines.push(
      "",
      `今回の開始offset：${startPastOffset.toLocaleString()}`,
      `取得件数：${apiFetchedCount.toLocaleString()}`,
      `次回offset：${nextPastOffset.toLocaleString()}`,
    );
    if (cycledPastCollection) {
      lines.unshift("過去作品を一周しました。", "");
    }
  }

  if (validCandidateCount === 0) {
    lines[0] =
      mode === "new"
        ? `新作を${apiFetchedCount.toLocaleString()}件取得しましたが、有効な候補は見つかりませんでした。`
        : `過去作品を${apiFetchedCount.toLocaleString()}件取得しましたが、有効な候補は見つかりませんでした。`;
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
): Promise<CollectImportCandidatesResult> {
  const list = await buildImportCandidatesListFromRecords(records, {
    page: 1,
  });
  const displayedCount = list.candidates.length;

  return {
    success: true,
    configured: true,
    collectedCount: addedCount,
    displayedCount,
    count: list.pagination.totalCount,
    candidates: list.candidates,
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
    message,
    summary: list.summary,
    pagination: list.pagination,
  };
}

type CollectLoopResult = {
  selected: StoredImportCandidate[];
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
}): Promise<CollectLoopResult> {
  const { mode, requestCount, startOffset, pageSize, blockContext } = input;
  const exclusionStats = createEmptyExclusionStats();
  const selected: StoredImportCandidate[] = [];

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
        page = await fetchCollectPage(currentOffset, hits);
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

      updateImportCollectProgress({
        apiFetchedCount,
        currentPage: pagesFetched,
      });

      if (pageItems.length === 0) {
        fetchCompleted = true;
        if (mode === "past") {
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
          dmmItemToStoredCandidate(item, `fanza-${mode}`, {
            collectionMode: mode,
          }),
        );
      }

      currentOffset += pageItems.length;

      if (apiFetchedCount >= requestCount) {
        fetchCompleted = true;
        break;
      }

      if (
        mode === "past" &&
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
        if (mode === "past") {
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
        summary: emptyList.summary,
        pagination: emptyList.pagination,
      };
    }

    const pageSize = IMPORT_COLLECT_PAGE_SIZE;

    const { catalogIds, catalogProductIds } = getExistingCatalogIdSets();
    const { records: existingRecords, sha: candidatesSha } =
      await loadImportCandidates();
    const { state: collectionState, sha: stateSha } =
      await loadImportCollectionState();

    const savedPastOffset = normalizeDmmOffset(collectionState.pastOffset);
    const startPastOffset =
      mode === "past"
        ? normalizeDmmOffset(options.startOffset ?? savedPastOffset)
        : 1;

    const blockContext = createImportCollectBlockContext(
      catalogIds,
      catalogProductIds,
      existingRecords,
    );

    const loopResult = await runCollectLoop({
      mode,
      requestCount,
      startOffset: mode === "past" ? startPastOffset : 1,
      pageSize,
      blockContext,
    });

    const nextPastOffset =
      mode === "past" ? loopResult.currentOffset : collectionState.pastOffset;

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
      startPastOffset,
      nextPastOffset,
      cycledPastCollection: loopResult.cycledPastCollection,
      fetchCompleted: loopResult.fetchCompleted,
    };

    const now = new Date().toISOString();
    const nextState: ImportCollectionState = {
      ...collectionState,
      pastOffset: mode === "past" ? nextPastOffset : collectionState.pastOffset,
      lastPastStartOffset:
        mode === "past" ? startPastOffset : collectionState.lastPastStartOffset,
      pageSize,
      lastCollectedAt: now,
      lastNewCollectedAt:
        mode === "new" ? now : collectionState.lastNewCollectedAt,
      lastPastCollectedAt:
        mode === "past" ? now : collectionState.lastPastCollectedAt,
      lastMode: mode,
      cycleCount:
        mode === "past" && loopResult.cycledPastCollection
          ? collectionState.cycleCount + 1
          : collectionState.cycleCount,
    };

    if (loopResult.selected.length === 0) {
      await saveImportCandidatesAndCollectionState(
        existingRecords,
        nextState,
        candidatesSha,
        stateSha,
        mode === "past"
          ? "Advance import past collection offset via admin"
          : "Run import new collection via admin",
      );

      runStats.collectionState = nextState;
      runStats.nextPastOffset = nextState.pastOffset;

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

    runStats.addedCandidateCount = addedCount;
    runStats.collectionState = nextState;
    runStats.nextPastOffset = nextState.pastOffset;

    return buildSuccessResult(
      records,
      buildCollectMessage(mode, runStats, addedCount),
      runStats,
      addedCount,
    );
  } finally {
    collectInProgress = false;
  }
}
