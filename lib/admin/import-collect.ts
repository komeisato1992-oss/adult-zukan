import "server-only";

import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import {
  acceptImportCollectItem,
  createEmptyExclusionStats,
  createImportCollectBlockContext,
  getExistingCatalogIdSets,
} from "@/lib/admin/import-collect-filters";
import type {
  CollectImportCandidatesResult,
  ImportCollectionMode,
  ImportCollectRunStats,
} from "@/lib/admin/import-collect-types";
import {
  IMPORT_COLLECT_MAX_PAGES_NEW,
  IMPORT_COLLECT_MAX_PAGES_PAST,
  IMPORT_COLLECT_PAGE_SIZE,
  IMPORT_COLLECT_TARGET_COUNT,
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
import { storedRecordToListItem } from "@/lib/admin/import-candidates-visibility";
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
  pageSize: number,
): Promise<FetchPageResult> {
  const response = await fetchDmmItemList({
    sort: "date",
    hits: pageSize,
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
  const { exclusionStats, apiFetchedCount, nextPastOffset, cycledPastCollection } =
    runStats;

  const duplicateInvalid =
    exclusionStats.duplicate + exclusionStats.invalid + exclusionStats.alreadyPending;

  const lines = [
    mode === "new"
      ? `新作を${apiFetchedCount.toLocaleString()}件確認し、新しい候補を${addedCount.toLocaleString()}件追加しました。`
      : `過去作品を${apiFetchedCount.toLocaleString()}件確認し、新しい候補を${addedCount.toLocaleString()}件追加しました。`,
    "",
    "除外内訳：",
    `- 掲載済み：${exclusionStats.catalogPublished.toLocaleString()}件`,
    `- 追加済み：${exclusionStats.alreadyAdded.toLocaleString()}件`,
    `- 除外済み：${exclusionStats.alreadyExcluded.toLocaleString()}件`,
    `- 画像なし：${exclusionStats.noImage.toLocaleString()}件`,
    `- 重複・無効：${duplicateInvalid.toLocaleString()}件`,
  ];

  if (mode === "past") {
    lines.push("", `次回offset：${nextPastOffset.toLocaleString()}`);
    if (cycledPastCollection) {
      lines.unshift("過去作品を一周しました。", "");
    }
  }

  if (addedCount === 0) {
    const emptyLines = [
      mode === "new"
        ? `新作を${apiFetchedCount.toLocaleString()}件確認しましたが、新しい候補は見つかりませんでした。`
        : `過去作品を${apiFetchedCount.toLocaleString()}件確認しましたが、新しい候補は見つかりませんでした。`,
      "",
      "除外内訳：",
      `- 掲載済み：${exclusionStats.catalogPublished.toLocaleString()}件`,
      `- 追加済み：${exclusionStats.alreadyAdded.toLocaleString()}件`,
      `- 除外済み：${exclusionStats.alreadyExcluded.toLocaleString()}件`,
      `- 画像なし：${exclusionStats.noImage.toLocaleString()}件`,
      `- 重複・無効：${duplicateInvalid.toLocaleString()}件`,
    ];

    if (mode === "past") {
      emptyLines.push("", `次回offset：${nextPastOffset.toLocaleString()}`);
      if (cycledPastCollection) {
        emptyLines.push("", "過去作品を一周しました。");
      }
    }

    return emptyLines.join("\n");
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
  const allCandidates = records.map(storedRecordToListItem);
  const list = await buildImportCandidatesListFromRecords(records, {
    page: 1,
    includeAll: true,
  });
  const displayedCount = list.candidates.length;

  return {
    success: true,
    configured: true,
    collectedCount: addedCount,
    displayedCount,
    count: displayedCount,
    candidates: allCandidates,
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
    includeAll: true,
  });

  return {
    success: true,
    configured: true,
    collectedCount: 0,
    displayedCount: list.candidates.length,
    count: list.candidates.length,
    candidates: existingRecords.map(storedRecordToListItem),
    message,
    summary: list.summary,
    pagination: list.pagination,
  };
}

export async function collectImportCandidates(
  mode: ImportCollectionMode,
): Promise<CollectImportCandidatesResult> {
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
    const maxPages =
      mode === "new"
        ? IMPORT_COLLECT_MAX_PAGES_NEW
        : IMPORT_COLLECT_MAX_PAGES_PAST;
    const targetCount = IMPORT_COLLECT_TARGET_COUNT;

    const { catalogIds, catalogProductIds } = getExistingCatalogIdSets();
    const { records: existingRecords, sha: candidatesSha } =
      await loadImportCandidates();
    const { state: collectionState, sha: stateSha } =
      await loadImportCollectionState();

    const blockContext = createImportCollectBlockContext(
      catalogIds,
      catalogProductIds,
      existingRecords,
    );
    const exclusionStats = createEmptyExclusionStats();
    const selected: StoredImportCandidate[] = [];

    let apiFetchedCount = 0;
    let pagesFetched = 0;
    let currentOffset =
      mode === "past" ? collectionState.pastOffset : 1;
    let cycledPastCollection = false;
    let lastTotalCount: number | null = null;

    while (
      pagesFetched < maxPages &&
      selected.length < targetCount
    ) {
      let page: FetchPageResult;

      try {
        page = await fetchCollectPage(currentOffset, pageSize);
      } catch (error) {
        if (pagesFetched === 0) {
          throw error;
        }
        break;
      }

      pagesFetched += 1;
      apiFetchedCount += page.items.length;
      lastTotalCount = page.totalCount;

      if (page.items.length === 0) {
        if (mode === "past") {
          cycledPastCollection = true;
          currentOffset = 1;
          collectionState.cycleCount += 1;
        }
        break;
      }

      for (const item of page.items) {
        if (!acceptImportCollectItem(item, blockContext, exclusionStats)) {
          continue;
        }

        selected.push(
          dmmItemToStoredCandidate(item, `fanza-${mode}`, {
            collectionMode: mode,
          }),
        );

        if (selected.length >= targetCount) {
          break;
        }
      }

      const nextOffsetAfterPage = currentOffset + pageSize;

      if (
        mode === "past" &&
        lastTotalCount != null &&
        nextOffsetAfterPage > lastTotalCount
      ) {
        cycledPastCollection = true;
        currentOffset = 1;
        collectionState.cycleCount += 1;
        break;
      }

      currentOffset = nextOffsetAfterPage;

      if (page.items.length < pageSize) {
        if (mode === "past") {
          cycledPastCollection = true;
          currentOffset = 1;
          collectionState.cycleCount += 1;
        }
        break;
      }
    }

    const nextPastOffset = mode === "past" ? currentOffset : collectionState.pastOffset;

    const runStats: ImportCollectRunStats = {
      mode,
      apiFetchedCount,
      pagesFetched,
      addedCandidateCount: 0,
      exclusionStats,
      collectionState: {
        ...collectionState,
        pageSize,
      },
      nextPastOffset,
      cycledPastCollection,
    };

    if (selected.length === 0) {
      if (pagesFetched > 0) {
        const now = new Date().toISOString();
        const nextState: ImportCollectionState = {
          ...collectionState,
          pastOffset: mode === "past" ? nextPastOffset : collectionState.pastOffset,
          pageSize,
          lastCollectedAt: now,
          lastNewCollectedAt:
            mode === "new" ? now : collectionState.lastNewCollectedAt,
          lastPastCollectedAt:
            mode === "past" ? now : collectionState.lastPastCollectedAt,
          lastMode: mode,
          cycleCount: collectionState.cycleCount,
        };

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
      }

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
      selected,
    );

    const now = new Date().toISOString();
    const nextState: ImportCollectionState = {
      ...collectionState,
      pastOffset: mode === "past" ? nextPastOffset : collectionState.pastOffset,
      pageSize,
      lastCollectedAt: now,
      lastNewCollectedAt:
        mode === "new" ? now : collectionState.lastNewCollectedAt,
      lastPastCollectedAt:
        mode === "past" ? now : collectionState.lastPastCollectedAt,
      lastMode: mode,
      cycleCount: collectionState.cycleCount,
    };

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
