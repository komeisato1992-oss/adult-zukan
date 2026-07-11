"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImportBulkConfirmModal } from "@/components/admin/ImportBulkConfirmModal";
import { ImportBulkSnsPanel } from "@/components/admin/ImportBulkSnsPanel";
import { ImportBulkToolbar } from "@/components/admin/ImportBulkToolbar";
import { ImportCandidateCard } from "@/components/admin/ImportCandidateCard";
import { ImportDebugPanel } from "@/components/admin/ImportDebugPanel";
import { ImportFilterBar } from "@/components/admin/ImportFilterBar";
import { ImportSortBar } from "@/components/admin/ImportSortBar";
import { ImportSummaryBar, type ImportCollectParams } from "@/components/admin/ImportSummaryBar";
import { PopularCollectPanel } from "@/components/admin/PopularCollectPanel";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import type { ImportCollectProgress } from "@/lib/admin/import-collect-progress";
import {
  IMPORT_COLLECT_REQUEST_COUNT,
} from "@/lib/admin/import-constants";
import {
  type BulkAddLimitChoice,
  resolveBulkAddLimit,
} from "@/lib/admin/bulk-add-limit";
import { IMPORT_BULK_ADD_DEFAULT } from "@/lib/admin/import-constants";
import { formatImportSourceLabel } from "@/lib/admin/import-source-labels";
import type { ImportBulkConfirmSummary, ImportFilterKey } from "@/lib/admin/import-quality";
import { getImportQualityFlags } from "@/lib/admin/import-quality";
import type { ImportBatchJob } from "@/lib/admin/import-batch-job";
import {
  buildBulkAddApiRequest,
  clearSelectionState,
  createEmptySelectionState,
  describeSelectionForDebug,
  getSelectedCount,
  hasSelection,
  isCandidateSelected,
  selectAllMatching,
  selectExplicitIds,
  toggleCandidateSelection,
  type ImportSelectionState,
} from "@/lib/admin/import-selection";
import type { DmmItem } from "@/lib/dmm/types";

type ImportManagementInitialData = ImportCandidatesListResult & {
  configured: boolean;
  dmmConfigured: boolean;
  message?: string;
  jsonCorrupt?: boolean;
};

type ImportManagementClientProps = {
  initialData: ImportManagementInitialData;
};

function buildFiltersQuery(filters: Set<ImportFilterKey>): string {
  return [...filters].join(",");
}

export function ImportManagementClient({
  initialData,
}: ImportManagementClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(initialData.pagination.page);
  const [sort, setSort] = useState<ImportCandidateSortKey>("collectedAt-desc");
  const [selection, setSelection] = useState<ImportSelectionState>(
    createEmptySelectionState(),
  );
  const [selectedItemById, setSelectedItemById] = useState<Record<string, DmmItem>>(
    {},
  );
  const [addLimit, setAddLimit] = useState<BulkAddLimitChoice>(
    IMPORT_BULK_ADD_DEFAULT,
  );
  const [pendingBulkWorks, setPendingBulkWorks] = useState<
    Array<{ contentId: string; item: DmmItem }>
  >([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<ImportFilterKey>>(
    new Set(),
  );
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<DmmItem[]>([]);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());
  const [confirmSummary, setConfirmSummary] = useState<ImportBulkConfirmSummary | null>(
    null,
  );
  const [bulkAddMessage, setBulkAddMessage] = useState<string | null>(null);
  const [bulkAddError, setBulkAddError] = useState<string | null>(null);
  const [bulkAddDebug, setBulkAddDebug] = useState<string | null>(null);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [collectingMode, setCollectingMode] = useState<ImportCollectionMode | null>(
    null,
  );
  const [collectProgress, setCollectProgress] =
    useState<ImportCollectProgress | null>(null);
  const [requestCount, setRequestCount] = useState(IMPORT_COLLECT_REQUEST_COUNT);
  const [startOffsetInput, setStartOffsetInput] = useState("");
  const [offsetError, setOffsetError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonCorrupt, setJsonCorrupt] = useState(Boolean(initialData.jsonCorrupt));
  const [isResettingJson, setIsResettingJson] = useState(false);
  const [resetJsonMessage, setResetJsonMessage] = useState<string | null>(null);
  const [batchJob, setBatchJob] = useState<ImportBatchJob | null>(null);
  const [serverBatchInProgress, setServerBatchInProgress] = useState(false);
  const collectInFlightRef = useRef(false);
  const candidateListRef = useRef<HTMLDivElement>(null);

  const visibleCandidates = useMemo(
    () => data.candidates,
    [data.candidates],
  );

  const filteredTotalCount = data.pagination.totalCount;
  const candidateTotalCount = Math.max(
    filteredTotalCount,
    data.summary.candidateCount,
  );
  const hasPendingCandidates = candidateTotalCount > 0;
  const selectedCount = getSelectedCount(selection, filteredTotalCount);

  const scrollToCandidateList = useCallback(() => {
    window.requestAnimationFrame(() => {
      candidateListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const applyCandidatesPayload = useCallback(
    (payload: ImportManagementInitialData, options?: { resetSelection?: boolean }) => {
      setData((current) => ({
        ...current,
        ...payload,
        configured: payload.configured ?? current.configured,
        dmmConfigured: payload.dmmConfigured ?? current.dmmConfigured,
        message: undefined,
      }));
      setPage(payload.pagination?.page ?? 1);

      if (options?.resetSelection !== false) {
        setSelection(clearSelectionState());
        setSelectedItemById({});
      }
    },
    [],
  );

  const selectedWorksForBulk = useMemo(
    () =>
      selection.mode === "explicit"
        ? [...selection.selectedIds]
            .map((contentId) => ({
              contentId,
              item: selectedItemById[contentId],
            }))
            .filter(
              (
                entry,
              ): entry is {
                contentId: string;
                item: DmmItem;
              } => Boolean(entry.item),
            )
        : [],
    [selection, selectedItemById],
  );

  const comparePool = useMemo(
    () => visibleCandidates.map((candidate) => candidate.item),
    [visibleCandidates],
  );

  const loadCandidates = useCallback(
    async (options: {
      nextPage?: number;
      nextSort?: ImportCandidateSortKey;
      nextFilters?: Set<ImportFilterKey>;
      preserveSelection?: boolean;
    } = {}) => {
      const targetPage = options.nextPage ?? page;
      const targetSort = options.nextSort ?? sort;
      const targetFilters = options.nextFilters ?? activeFilters;

      const params = new URLSearchParams({
        page: String(targetPage),
        sort: targetSort,
      });

      const filtersQuery = buildFiltersQuery(targetFilters);
      if (filtersQuery) {
        params.set("filters", filtersQuery);
      }

      const response = await fetch(
        `/api/admin/import/get-candidates?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "候補一覧の取得に失敗しました。");
      }

      const payload = (await response.json()) as ImportManagementInitialData;

      applyCandidatesPayload(payload, {
        resetSelection: !options.preserveSelection,
      });
      setSort(targetSort);
    },
    [page, sort, activeFilters, applyCandidatesPayload],
  );

  useEffect(() => {
    let cancelled = false;

    const pollBatchJob = () =>
      fetch("/api/admin/import/batch-job", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok || cancelled) return null;
          return (await response.json()) as {
            job?: ImportBatchJob;
            inProgress?: boolean;
          };
        })
        .then((payload) => {
          if (!payload || cancelled) return;
          if (payload.job) setBatchJob(payload.job);
          setServerBatchInProgress(payload.inProgress === true);
        })
        .catch(() => undefined);

    pollBatchJob();
    const timer = window.setInterval(pollBatchJob, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/import/get-candidates?page=1", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return null;
        return (await response.json()) as ImportManagementInitialData;
      })
      .then((payload) => {
        if (!payload || cancelled) return;
        applyCandidatesPayload(payload, { resetSelection: false });
      })
      .catch(() => {
        // 初期表示はサーバー描画の値を維持
      });

    return () => {
      cancelled = true;
    };
  }, [applyCandidatesPayload]);

  const handleExclude = useCallback(
    async (contentId: string) => {
      setError(null);

      try {
        const response = await fetch("/api/admin/import/exclude-work", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentId }),
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "除外に失敗しました。");
        }

        setSelection((current) =>
          toggleCandidateSelection(current, contentId, false, {
            filters: [...activeFilters],
            sort,
            filteredTotalCount,
          }),
        );
        setSelectedItemById((current) => {
          const next = { ...current };
          delete next[contentId];
          return next;
        });
        await loadCandidates();
      } catch (excludeError) {
        setError(
          excludeError instanceof Error
            ? excludeError.message
            : "除外に失敗しました。",
        );
      }
    },
    [loadCandidates, activeFilters, sort, filteredTotalCount],
  );

  const handleSelectedChange = useCallback(
    (contentId: string, selected: boolean, item?: DmmItem) => {
      setSelection((current) =>
        toggleCandidateSelection(current, contentId, selected, {
          filters: [...activeFilters],
          sort,
          filteredTotalCount,
        }),
      );

      setSelectedItemById((current) => {
        if (selection.mode === "allMatching" || selected === false) {
          const next = { ...current };
          delete next[contentId];
          return next;
        }
        if (selected && item) {
          return { ...current, [contentId]: item };
        }
        return current;
      });
    },
    [activeFilters, sort, selection.mode, filteredTotalCount],
  );

  const handleToggleFilter = useCallback(
    async (key: ImportFilterKey) => {
      const nextFilters = new Set(activeFilters);
      if (nextFilters.has(key)) {
        nextFilters.delete(key);
      } else {
        nextFilters.add(key);
      }

      setActiveFilters(nextFilters);
      setIsLoading(true);
      setError(null);

      try {
        await loadCandidates({ nextPage: 1, nextFilters });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "候補一覧の取得に失敗しました。",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilters, loadCandidates],
  );

  const handleClearFilters = useCallback(async () => {
    const nextFilters = new Set<ImportFilterKey>();
    setActiveFilters(nextFilters);
    setIsLoading(true);
    setError(null);

    try {
      await loadCandidates({ nextPage: 1, nextFilters });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "候補一覧の取得に失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadCandidates]);

  const handleSelectPage = useCallback(() => {
    setBulkAddError(null);
    setBulkAddDebug(null);
    const pageIds = visibleCandidates
      .filter((candidate) => !addedIds.has(candidate.contentId))
      .map((candidate) => candidate.contentId);

    setSelection(selectExplicitIds(pageIds));
    setSelectedItemById((current) => {
      const next = { ...current };
      for (const candidate of visibleCandidates) {
        if (!addedIds.has(candidate.contentId)) {
          next[candidate.contentId] = candidate.item;
        }
      }
      return next;
    });
  }, [visibleCandidates, addedIds]);

  const handleSelectAllMatching = useCallback(() => {
    setBulkAddError(null);
    setBulkAddDebug(null);
    setSelection(
      selectAllMatching({
        filters: [...activeFilters],
        sort,
        filteredTotalCount,
      }),
    );
    setSelectedItemById({});
  }, [activeFilters, sort, filteredTotalCount]);

  const handleClearSelection = useCallback(() => {
    setBulkAddError(null);
    setBulkAddDebug(null);
    setSelection(clearSelectionState());
    setSelectedItemById({});
  }, []);

  const handleSelectByFlag = useCallback(
    (flag: ImportFilterKey) => {
      const pageIds = visibleCandidates
        .filter((candidate) => {
          if (addedIds.has(candidate.contentId)) return false;
          return getImportQualityFlags(candidate.item)[flag];
        })
        .map((candidate) => candidate.contentId);

      setSelection(selectExplicitIds(pageIds));
      setSelectedItemById((current) => {
        const next = { ...current };
        for (const candidate of visibleCandidates) {
          if (addedIds.has(candidate.contentId)) continue;
          if (getImportQualityFlags(candidate.item)[flag]) {
            next[candidate.contentId] = candidate.item;
          }
        }
        return next;
      });
    },
    [visibleCandidates, addedIds],
  );

  async function handleCollect(
    mode: ImportCollectionMode,
    params: ImportCollectParams,
  ) {
    if (collectInFlightRef.current) {
      return;
    }
    collectInFlightRef.current = true;

    setCollectingMode(mode);
    setError(null);
    setCollectMessage(null);
    setOffsetError(null);
    setCollectProgress(null);

    if (mode === "past" && params.startOffset !== null) {
      const numeric = params.startOffset;
      if (!Number.isInteger(numeric) || numeric < 0) {
        setOffsetError("開始offsetは0以上の整数で指定してください。");
        setCollectingMode(null);
        collectInFlightRef.current = false;
        return;
      }
    }

    const progressTimer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/import/collect-progress", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          progress?: ImportCollectProgress;
        };
        if (payload.progress?.active) {
          setCollectProgress(payload.progress);
        }
      } catch {
        // 進捗取得失敗は無視
      }
    }, 500);

    try {
      const body: Record<string, unknown> = {
        mode,
        requestCount: params.requestCount,
      };
      if (mode === "past") {
        body.startOffset =
          params.startOffset === null ? "" : params.startOffset;
      }

      const response = await fetch("/api/admin/import/collect-candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as ImportManagementInitialData & {
        error?: string;
        success?: boolean;
        collectedCount?: number;
        displayedCount?: number;
        message?: string;
        candidates?: ImportCandidatesListResult["candidates"];
        runStats?: {
          nextPastOffset?: number;
          startPastOffset?: number;
        };
      };

      if (!response.ok) {
        if (
          response.status === 400 ||
          (payload.error && payload.error.includes("offset"))
        ) {
          setOffsetError(payload.error ?? "開始offsetが不正です。");
        }
        throw new Error(payload.error ?? "候補の収集に失敗しました。");
      }

      if (payload.summary) {
        applyCandidatesPayload(
          {
            ...payload,
            configured: data.configured,
            dmmConfigured: data.dmmConfigured,
          },
          { resetSelection: true },
        );
        setActiveFilters(new Set());
      } else {
        await loadCandidates({ nextPage: 1, nextFilters: new Set() });
      }

      if (mode === "past" && payload.runStats?.nextPastOffset != null) {
        setStartOffsetInput("");
      }

      setCollectMessage(
        payload.message ??
          (payload.displayedCount && payload.displayedCount > 0
            ? `${payload.displayedCount}件の候補を表示しました。`
            : "候補を収集しましたが、表示できる候補がありません。"),
      );
      scrollToCandidateList();
    } catch (collectError) {
      setError(
        collectError instanceof Error
          ? collectError.message
          : "候補の収集に失敗しました。",
      );
    } finally {
      window.clearInterval(progressTimer);
      setCollectProgress(null);
      setCollectingMode(null);
      collectInFlightRef.current = false;
    }
  }

  async function handleResetJson() {
    setIsResettingJson(true);
    setError(null);
    setResetJsonMessage(null);

    try {
      const response = await fetch("/api/admin/import/reset-candidates", {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "import-candidates.json の初期化に失敗しました。");
      }

      setJsonCorrupt(false);
      setResetJsonMessage(payload.message ?? "import-candidates.json を初期化しました。");
      await loadCandidates({ nextPage: 1 });
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "import-candidates.json の初期化に失敗しました。",
      );
    } finally {
      setIsResettingJson(false);
    }
  }

  async function handleSortChange(nextSort: ImportCandidateSortKey) {
    setIsLoading(true);
    setError(null);

    try {
      await loadCandidates({ nextPage: 1, nextSort });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "候補一覧の取得に失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePageChange(nextPage: number) {
    setIsLoading(true);
    setError(null);

    try {
      await loadCandidates({ nextPage, preserveSelection: true });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "候補一覧の取得に失敗しました。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkAddRequest() {
    setBulkAddError(null);
    setBulkAddDebug(null);

    const debugInfo = describeSelectionForDebug(selection, filteredTotalCount);
    console.log("bulk add request", {
      ...debugInfo,
      addLimit,
    });

    if (!hasSelection(selection, filteredTotalCount)) {
      setBulkAddError("追加する作品を選択してください。");
      return;
    }

    const appliedLimit = resolveBulkAddLimit(addLimit, selectedCount);
    const requestBody = buildBulkAddApiRequest(selection, appliedLimit);

    if (!requestBody) {
      setBulkAddError("追加する作品を選択してください。");
      return;
    }

    setIsPreviewLoading(true);

    try {
      const response = await fetch("/api/admin/import/bulk-add-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as {
        error?: string;
        debug?: {
          selectionMode: string;
          receivedSelectedCount: number;
          resolvedCount: number;
          afterLimitCount: number;
          appliedLimit: number;
        };
        selectedCount: number;
        toAddCount: number;
        duplicateCount: number;
        qualitySummary: {
          total: number;
          noImage: number;
          noActress: number;
          noPrice: number;
          noDescription: number;
          noSampleImages: number;
        };
      };

      if (!response.ok) {
        if (payload.debug) {
          setBulkAddDebug(
            `mode=${payload.debug.selectionMode} / 受信=${payload.debug.receivedSelectedCount}件 / 再抽出=${payload.debug.resolvedCount}件 / 上限適用後=${payload.debug.afterLimitCount}件`,
          );
        }
        throw new Error(payload.error ?? "追加内容の確認に失敗しました。");
      }

      setConfirmSummary({
        selectedCount: payload.selectedCount,
        toAddCount: payload.toAddCount,
        duplicateCount: payload.duplicateCount,
        total: payload.qualitySummary.total,
        noImage: payload.qualitySummary.noImage,
        noActress: payload.qualitySummary.noActress,
        noPrice: payload.qualitySummary.noPrice,
        noDescription: payload.qualitySummary.noDescription,
        noSampleImages: payload.qualitySummary.noSampleImages,
      });
      setPendingBulkWorks(
        selection.mode === "explicit" ? selectedWorksForBulk.slice(0, appliedLimit) : [],
      );
      setShowConfirmModal(true);
    } catch (previewError) {
      setBulkAddError(
        previewError instanceof Error
          ? previewError.message
          : "追加内容の確認に失敗しました。",
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleBulkAddConfirm() {
    if (!hasSelection(selection, filteredTotalCount)) {
      setBulkAddError("追加する作品を選択してください。");
      setShowConfirmModal(false);
      return;
    }

    setIsBulkAdding(true);
    setBulkAddError(null);
    setBulkAddDebug(null);

    try {
      const appliedLimit = resolveBulkAddLimit(addLimit, selectedCount);
      const requestBody = buildBulkAddApiRequest(selection, appliedLimit);

      if (!requestBody) {
        throw new Error("追加する作品を選択してください。");
      }

      const response = await fetch("/api/admin/import/bulk-add-works", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as {
        error?: string;
        debug?: {
          selectionMode: string;
          receivedSelectedCount: number;
          resolvedCount: number;
          afterLimitCount: number;
          appliedLimit: number;
        };
        message?: string;
        addedCount?: number;
        addedContentIds?: string[];
      };

      if (!response.ok) {
        if (payload.debug) {
          setBulkAddDebug(
            `mode=${payload.debug.selectionMode} / 受信=${payload.debug.receivedSelectedCount}件 / 再抽出=${payload.debug.resolvedCount}件 / 上限適用後=${payload.debug.afterLimitCount}件`,
          );
        }
        throw new Error(payload.error ?? "一括追加に失敗しました。");
      }

      const addedContentIds = payload.addedContentIds ?? [];
      setAddedIds((current) => new Set([...current, ...addedContentIds]));
      setRecentlyAddedIds((current) => new Set([...current, ...addedContentIds]));
      setRecentlyAddedItems(
        pendingBulkWorks
          .filter((candidate) => addedContentIds.includes(candidate.contentId))
          .map((candidate) => candidate.item),
      );
      setSelection(clearSelectionState());
      setSelectedItemById({});
      setPendingBulkWorks([]);
      setBulkAddMessage(
        payload.message ??
          (payload.addedCount && payload.addedCount > 0
            ? "追加しました。Vercel反映まで数分かかります。"
            : "追加できる作品がありませんでした。"),
      );
      setConfirmSummary(null);
      setShowConfirmModal(false);
    } catch (bulkError) {
      setBulkAddError(
        bulkError instanceof Error
          ? bulkError.message
          : "一括追加に失敗しました。",
      );
      setShowConfirmModal(false);
    } finally {
      setIsBulkAdding(false);
    }
  }

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        GitHub 連携（GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH）が未設定のため、一括追加・デプロイができません。
      </div>
    );
  }

  if (!data.dmmConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        DMM API の認証情報が未設定のため、候補を収集できません（DMM_API_ID / DMM_AFFILIATE_ID）。
      </div>
    );
  }

  return (
    <div
      className={`space-y-6${hasPendingCandidates ? " pb-28 md:pb-6" : ""}`}
    >
      <ImportDebugPanel
        job={batchJob}
        serverInProgress={serverBatchInProgress}
        currentOffsetInput={startOffsetInput}
        persistedPastOffset={data.summary.collectionState.pastOffset}
        persistedNextPastOffset={data.summary.collectionState.nextPastOffset}
        persistedPopularOffset={data.summary.collectionState.nextPopularOffset}
        candidateTotalCount={candidateTotalCount}
        visibleCount={visibleCandidates.length}
        filteredTotalCount={filteredTotalCount}
        selection={selection}
        selectedCount={selectedCount}
      />

      <ImportSummaryBar
        summary={data.summary}
        visibleCount={data.summary.candidateCount}
        displayedCount={data.pagination.totalCount}
        collectingMode={collectingMode}
        collectProgress={collectProgress}
        requestCount={requestCount}
        startOffsetInput={startOffsetInput}
        offsetError={offsetError}
        onRequestCountChange={setRequestCount}
        onStartOffsetInputChange={(value) => {
          setStartOffsetInput(value);
          setOffsetError(null);
        }}
        onUseNextOffset={() => {
          setStartOffsetInput(
            String(data.summary.collectionState.nextPastOffset),
          );
          setOffsetError(null);
        }}
        onResetOffset={() => {
          setStartOffsetInput("0");
          setOffsetError(null);
        }}
        onUsePreviousOffset={() => {
          const previous = data.summary.collectionState.lastPastStartOffset;
          if (previous == null) return;
          setStartOffsetInput(String(previous));
          setOffsetError(null);
        }}
        onCollect={handleCollect}
      />

      <PopularCollectPanel
        currentCatalogCount={data.summary.publishedCount}
        popularOffset={data.summary.collectionState.nextPopularOffset}
        lastPopularStartOffset={
          data.summary.collectionState.lastPopularStartOffset
        }
        disabled={collectingMode !== null}
        onComplete={(message, collectResult) => {
          setCollectMessage(message);
          if (collectResult?.summary) {
            applyCandidatesPayload(
              {
                ...collectResult,
                configured: data.configured,
                dmmConfigured: data.dmmConfigured,
              },
              { resetSelection: true },
            );
            setActiveFilters(new Set());
          }
          scrollToCandidateList();
        }}
        onError={(message) => setError(message)}
        onRefresh={async () => {
          const params = new URLSearchParams({
            page: "1",
            sort,
          });
          const filtersQuery = buildFiltersQuery(activeFilters);
          if (filtersQuery) {
            params.set("filters", filtersQuery);
          }

          const response = await fetch(
            `/api/admin/import/get-candidates?${params.toString()}`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            return null;
          }

          const payload = (await response.json()) as ImportManagementInitialData;
          applyCandidatesPayload(payload, { resetSelection: true });
          setActiveFilters(new Set());
          return payload;
        }}
      />

      {data.message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{data.message}</p>
          {jsonCorrupt ? (
            <button
              type="button"
              onClick={handleResetJson}
              disabled={isResettingJson}
              className="mt-3 inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResettingJson
                ? "初期化中..."
                : "import-candidates.json を初期化する"}
            </button>
          ) : null}
        </div>
      ) : null}

      {resetJsonMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {resetJsonMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {collectMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm whitespace-pre-wrap text-emerald-800">
          {collectMessage}
        </div>
      ) : null}

      {bulkAddMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {bulkAddMessage}
        </div>
      ) : null}

      {bulkAddError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{bulkAddError}</p>
          {bulkAddDebug ? (
            <p className="mt-2 text-xs text-red-600">{bulkAddDebug}</p>
          ) : null}
        </div>
      ) : null}

      {recentlyAddedItems.length > 0 ? (
        <ImportBulkSnsPanel items={recentlyAddedItems} />
      ) : null}

      {hasPendingCandidates ? (
        <ImportBulkToolbar
          selectedCount={selectedCount}
          filteredTotalCount={filteredTotalCount}
          visibleCount={visibleCandidates.length}
          addLimit={addLimit}
          isBulkAdding={isBulkAdding || isPreviewLoading}
          onAddLimitChange={setAddLimit}
          onSelectPage={handleSelectPage}
          onSelectAllMatching={handleSelectAllMatching}
          onClearSelection={handleClearSelection}
          onSelectByFlag={handleSelectByFlag}
          onBulkAdd={handleBulkAddRequest}
        />
      ) : null}

      <ImportFilterBar
        activeFilters={activeFilters}
        onToggleFilter={handleToggleFilter}
        onClearFilters={handleClearFilters}
      />

      <ImportSortBar
        sort={sort}
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        totalCount={data.pagination.totalCount}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
      />

      <div ref={candidateListRef}>
      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted">
          読み込み中...
        </div>
      ) : visibleCandidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
          {hasPendingCandidates
            ? "フィルター条件に一致する候補がありません。フィルターを解除してください。"
            : "表示できる候補作品がありません。「新作を収集」または「過去作品を収集」で FANZA から未掲載作品を蓄積してください。"}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCandidates.map((candidate) => (
            <ImportCandidateCard
              key={candidate.contentId}
              item={candidate.item}
              source={candidate.source}
              sourceLabel={formatImportSourceLabel(candidate.source)}
              selected={
                isCandidateSelected(selection, candidate.contentId) &&
                !addedIds.has(candidate.contentId)
              }
              isAdded={addedIds.has(candidate.contentId)}
              emphasizeSns={recentlyAddedIds.has(candidate.contentId)}
              comparePool={comparePool}
              onSelectedChange={handleSelectedChange}
              onExclude={handleExclude}
            />
          ))}
        </div>
      )}
      </div>

      {showConfirmModal && confirmSummary ? (
        <ImportBulkConfirmModal
          summary={confirmSummary}
          isSubmitting={isBulkAdding}
          onConfirm={handleBulkAddConfirm}
          onCancel={() => {
            setShowConfirmModal(false);
            setConfirmSummary(null);
            setPendingBulkWorks([]);
          }}
        />
      ) : null}

      {hasPendingCandidates ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:hidden pb-[max(env(safe-area-inset-bottom),0px)]">
          <ImportBulkToolbar
            selectedCount={selectedCount}
            filteredTotalCount={filteredTotalCount}
            visibleCount={visibleCandidates.length}
            addLimit={addLimit}
            isBulkAdding={isBulkAdding || isPreviewLoading}
            compact
            onAddLimitChange={setAddLimit}
            onSelectPage={handleSelectPage}
            onSelectAllMatching={handleSelectAllMatching}
            onClearSelection={handleClearSelection}
            onSelectByFlag={handleSelectByFlag}
            onBulkAdd={handleBulkAddRequest}
          />
        </div>
      ) : null}
    </div>
  );
}
