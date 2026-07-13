"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImportCandidateCard } from "@/components/admin/ImportCandidateCard";
import { ImportFilterBar } from "@/components/admin/ImportFilterBar";
import { ImportSortBar } from "@/components/admin/ImportSortBar";
import {
  IMPORT_FETCH_REQUEST_DEFAULT,
  IMPORT_FETCH_REQUEST_OPTIONS,
  IMPORT_PAGE_SIZE,
  ADD_BATCH_SIZE,
} from "@/lib/admin/import-constants";
import {
  chunkItems,
  createAddProcessId,
  plannedBatchCount,
} from "@/lib/admin/add-batch-client";
import { CATALOG_REFRESH_BATCH_OPTIONS } from "@/lib/admin/catalog-refresh-constants";
import type { CatalogRefreshBatchSummary, CatalogRefreshState } from "@/lib/dmm/catalog-refresh-types";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import {
  getCandidateSelectionId,
  readCandidatesSession,
  readStoredOffset,
  readStoredPreviousOffset,
  readStoredSortMode,
  writeCandidatesSession,
  writeStoredOffset,
  writeStoredSortMode,
} from "@/lib/admin/import-session-storage";
import type {
  AdultImportSortMode,
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import {
  ADULT_IMPORT_SORT_OPTIONS,
  getAdultImportSortLabel,
  isAdultImportSortMode,
} from "@/lib/admin/import-simple-types";
import { formatImportSourceLabel } from "@/lib/admin/import-source-labels";
import {
  matchesImportFilters,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import { buildAddSelectedWorksPayload } from "@/lib/admin/import-add-payload";
import { parseJsonResponseBody } from "@/lib/admin/bulk-add-safe";
import type { SitemapPostImportResult } from "@/lib/admin/seo-types";
import type { DmmItem } from "@/lib/dmm/types";

const SELECT_CONTROL_CLASS =
  "mt-1 min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground";

function resolveInitialFetchSort(
  sessionSort: AdultImportSortMode | undefined,
): AdultImportSortMode {
  if (typeof window !== "undefined") {
    const fromQuery = new URLSearchParams(window.location.search).get("sort");
    if (isAdultImportSortMode(fromQuery)) return fromQuery;
  }
  if (isAdultImportSortMode(sessionSort)) return sessionSort;
  const stored = readStoredSortMode();
  if (stored) return stored;
  return "popular";
}

function syncSortQueryParam(sort: AdultImportSortMode): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("sort", sort);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore
  }
}
type ImportManagementClientProps = {
  configured: boolean;
  dmmConfigured: boolean;
  githubConfigured?: boolean;
};

type AddBatchProgress = {
  processId: string;
  totalSelected: number;
  batchCount: number;
  currentBatch: number;
  processedCount: number;
  status: "running" | "partial" | "done";
  batchStatuses: Array<"pending" | "running" | "done" | "failed">;
};

type AddSelectedResponseBody = {
  success?: boolean;
  message?: string;
  error?: string;
  phase?: string;
  details?: Record<string, unknown>;
  addedContentIds?: string[];
  sitemap?: SitemapPostImportResult;
  summary?: {
    addedCount: number;
    catalogDuplicateCount: number;
    selectionDuplicateCount: number;
    invalidCount: number;
    catalogCountAfter?: number;
    updatedShardFiles?: string[];
    newShardFiles?: string[];
  };
};

const PAGE_SIZE = IMPORT_PAGE_SIZE;

function sortCandidates(
  candidates: FetchedImportCandidate[],
  sort: ImportCandidateSortKey,
): FetchedImportCandidate[] {
  const next = [...candidates];

  switch (sort) {
    case "releaseDate-desc":
      return next.sort((a, b) =>
        (b.item.date ?? "").localeCompare(a.item.date ?? ""),
      );
    case "price-desc":
      return next.sort((a, b) => {
        const priceA = Number.parseFloat(a.item.prices?.price ?? "0");
        const priceB = Number.parseFloat(b.item.prices?.price ?? "0");
        return priceB - priceA;
      });
    case "actress-first":
      return next.sort((a, b) => {
        const actressA = a.item.iteminfo?.actress?.length ?? 0;
        const actressB = b.item.iteminfo?.actress?.length ?? 0;
        return actressB - actressA;
      });
    case "image-first":
      return next.sort((a, b) => {
        const imageA = Boolean(a.item.imageURL?.large || a.item.imageURL?.list);
        const imageB = Boolean(b.item.imageURL?.large || b.item.imageURL?.list);
        return Number(imageB) - Number(imageA);
      });
    case "random":
      return next.sort(() => Math.random() - 0.5);
    case "seoScore-desc":
    case "popular-desc":
    default:
      return next.sort((a, b) => {
        const rankA =
          a.candidateMeta?.absolutePopularityPosition ??
          a.rankPosition ??
          Number.MAX_SAFE_INTEGER;
        const rankB =
          b.candidateMeta?.absolutePopularityPosition ??
          b.rankPosition ??
          Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
  }
}

function candidateHasImage(candidate: FetchedImportCandidate): boolean {
  const image = candidate.item.imageURL;
  return Boolean(
    image?.large?.trim() || image?.list?.trim() || image?.small?.trim(),
  );
}

function candidateHasActress(candidate: FetchedImportCandidate): boolean {
  return (candidate.item.iteminfo?.actress?.length ?? 0) > 0;
}

function candidateHasPrice(candidate: FetchedImportCandidate): boolean {
  return Boolean(candidate.item.prices?.price?.trim());
}

export function ImportManagementClient({
  configured,
  dmmConfigured,
  githubConfigured = false,
}: ImportManagementClientProps) {
  const restoredSession = useMemo(() => readCandidatesSession(), []);

  const [fetchSort, setFetchSort] = useState<AdultImportSortMode>(() =>
    resolveInitialFetchSort(restoredSession?.sort),
  );
  const [candidates, setCandidates] = useState<FetchedImportCandidate[]>(
    restoredSession?.candidates ?? [],
  );
  const [summary, setSummary] = useState<FetchImportCandidatesSummary | null>(
    restoredSession?.summary ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<ImportFilterKey>>(
    new Set(),
  );
  const [sort, setSort] = useState<ImportCandidateSortKey>("popular-desc");
  const [page, setPage] = useState(1);
  const [requestedCount, setRequestedCount] = useState(
    IMPORT_FETCH_REQUEST_DEFAULT,
  );
  const [startOffsetInput, setStartOffsetInput] = useState("");
  const [previousOffset, setPreviousOffset] = useState<number | null>(() =>
    readStoredPreviousOffset(
      resolveInitialFetchSort(restoredSession?.sort),
    ),
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addSummary, setAddSummary] = useState<{
    addedCount: number;
    duplicateCount: number;
    invalidCount: number;
    catalogCount: number | null;
    updatedShardFiles: string[];
    newShardFiles: string[];
    batchCount: number;
    commitCount: number;
    sitemap: SitemapPostImportResult | null;
  } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addDebug, setAddDebug] = useState<string | null>(null);
  const [addProgress, setAddProgress] = useState<AddBatchProgress | null>(null);
  const [pendingResumeCandidates, setPendingResumeCandidates] = useState<
    FetchedImportCandidate[] | null
  >(null);
  const activeAddProcessIdRef = useRef<string | null>(null);
  const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);
  const [isAddingWorks, setIsAddingWorks] = useState(false);
  const [refreshState, setRefreshState] = useState<CatalogRefreshState | null>(
    null,
  );
  const [refreshCatalogCount, setRefreshCatalogCount] = useState<number | null>(
    null,
  );
  const [refreshBatchSize, setRefreshBatchSize] = useState(500);
  const [refreshPrioritizeSale, setRefreshPrioritizeSale] = useState(true);
  const [refreshPrioritizeStale, setRefreshPrioritizeStale] = useState(true);
  const [refreshPrioritizePopular, setRefreshPrioritizePopular] = useState(true);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] =
    useState<CatalogRefreshBatchSummary | null>(null);
  const [isRefreshingWorks, setIsRefreshingWorks] = useState(false);
  const candidateListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRefreshState() {
      try {
        const response = await fetch("/api/admin/import/refresh-state");
        const payload = await response.json();
        if (!response.ok || cancelled) return;
        setRefreshState(payload.state ?? null);
        setRefreshCatalogCount(
          typeof payload.catalogCount === "number" ? payload.catalogCount : null,
        );
        if (payload.state?.batchSize) {
          setRefreshBatchSize(payload.state.batchSize);
        }
        if (payload.state?.lastBatchSummary) {
          setRefreshSummary(payload.state.lastBatchSummary);
        }
      } catch (error) {
        console.error("[import] refresh state load failed", error);
      }
    }

    void loadRefreshState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStoredSortMode(fetchSort);
    syncSortQueryParam(fetchSort);
  }, [fetchSort]);

  useEffect(() => {
    if (candidates.length === 0) return;
    writeCandidatesSession({
      sort: fetchSort,
      candidates,
      summary,
    });
  }, [candidates, summary, fetchSort]);

  useEffect(() => {
    const stored = readStoredOffset(fetchSort);
    if (startOffsetInput === "" && stored != null && stored > 0) {
      setStartOffsetInput(String(stored));
    }
    // 初回のみモード用 offset を入力へ反映
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCandidates = useMemo(() => {
    const filtered = candidates.filter((candidate) =>
      matchesImportFilters(candidate.item, activeFilters),
    );
    return sortCandidates(filtered, sort);
  }, [activeFilters, candidates, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCandidates = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCandidates.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredCandidates]);

  const selectedCount = selectedIds.size;

  const resolveStartOffset = useCallback((): number => {
    const trimmed = startOffsetInput.trim();
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }

    const stored = readStoredOffset(fetchSort);
    return stored ?? 0;
  }, [startOffsetInput, fetchSort]);

  const handleFetchCandidates = useCallback(async () => {
    setFetchError(null);
    setAddMessage(null);
    setAddError(null);
    setIsFetchingCandidates(true);

    const startOffset = resolveStartOffset();
    setPreviousOffset(startOffset);
    writeStoredOffset(fetchSort, startOffset, { previousOffset: startOffset });

    try {
      const response = await fetch("/api/admin/import/fetch-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort: fetchSort,
          offset: startOffset,
          requestedCount,
        }),
      });

      const parsed = await parseJsonResponseBody<{
        candidates?: FetchedImportCandidate[];
        summary?: FetchImportCandidatesSummary;
        error?: string;
      }>(response);

      if (!response.ok || !parsed.ok) {
        const serverError =
          parsed.ok && parsed.data.error ? parsed.data.error : null;
        throw new Error(
          serverError ??
            (!parsed.ok ? parsed.error.message : undefined) ??
            "候補の取得に失敗しました。カタログは変更されていません。",
        );
      }

      const payload = parsed.data;

      const nextCandidates = payload.candidates ?? [];
      const nextSummary = payload.summary ?? null;

      setCandidates(nextCandidates);
      setSummary(nextSummary);
      setSelectedIds(new Set());
      setPage(1);
      setSort(fetchSort === "new" ? "releaseDate-desc" : "popular-desc");

      if (nextSummary) {
        writeStoredOffset(fetchSort, nextSummary.nextOffset, {
          previousOffset: startOffset,
        });
      }

      window.requestAnimationFrame(() => {
        candidateListRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (error) {
      console.error("[import] fetch candidates failed", error);
      setFetchError(
        error instanceof Error
          ? error.message
          : "候補の取得に失敗しました。カタログは変更されていません。",
      );
    } finally {
      setIsFetchingCandidates(false);
    }
  }, [requestedCount, resolveStartOffset, fetchSort]);

  const runAddBatches = useCallback(
    async (
      candidatesToAdd: FetchedImportCandidate[],
      options?: { resume?: boolean },
    ) => {
      const processId = createAddProcessId();
      if (activeAddProcessIdRef.current) {
        setAddError("追加処理が既に実行中です。完了するまでお待ちください。");
        return;
      }

      activeAddProcessIdRef.current = processId;
      setAddError(null);
      setAddMessage(null);
      setAddSummary(null);
      setAddDebug(null);
      setPendingResumeCandidates(null);

      const totalSelected = candidatesToAdd.length;
      const batches = chunkItems(candidatesToAdd, ADD_BATCH_SIZE);
      const batchCount = batches.length;

      if (totalSelected === 0) {
        activeAddProcessIdRef.current = null;
        setAddError("追加する作品が選択されていません。");
        return;
      }

      setIsAddingWorks(true);
      setAddProgress({
        processId,
        totalSelected,
        batchCount,
        currentBatch: 0,
        processedCount: 0,
        status: "running",
        batchStatuses: batches.map(() => "pending"),
      });

      let addedCount = 0;
      let catalogDuplicateCount = 0;
      let selectionDuplicateCount = 0;
      let invalidCount = 0;
      let catalogCountAfter: number | null = null;
      const updatedShardFiles = new Set<string>();
      const newShardFiles = new Set<string>();
      const allAddedIds: string[] = [];
      let commitCount = 0;
      let failedBatchIndex: number | null = null;
      let remainingCandidates: FetchedImportCandidate[] = [];

      try {
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
          if (activeAddProcessIdRef.current !== processId) {
            break;
          }

          const batch = batches[batchIndex];
          setAddProgress((current) => {
            if (!current || current.processId !== processId) return current;
            const batchStatuses = [...current.batchStatuses];
            batchStatuses[batchIndex] = "running";
            return {
              ...current,
              currentBatch: batchIndex + 1,
              batchStatuses,
            };
          });

          const payload = {
            ...buildAddSelectedWorksPayload(batch),
            updateSitemap: false,
            processId,
            batchIndex: batchIndex + 1,
            batchCount,
          };

          console.log("[add-selected] batch request", {
            processId,
            batchIndex: batchIndex + 1,
            batchCount,
            workCount: payload.works.length,
            payloadBytes: JSON.stringify(payload).length,
          });

          const response = await fetch("/api/admin/import/add-selected-works", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const responseText = await response.text();

          let parsedBody: AddSelectedResponseBody | null = null;
          if (responseText.trim()) {
            try {
              parsedBody = JSON.parse(responseText) as AddSelectedResponseBody;
            } catch (parseError) {
              console.error("[add-selected] json parse failed", parseError);
            }
          }

          const requestFailed =
            !response.ok ||
            (parsedBody !== null && parsedBody.success === false);

          if (requestFailed) {
            failedBatchIndex = batchIndex;
            remainingCandidates = batches
              .slice(batchIndex)
              .flatMap((entries) => entries);

            const phase = parsedBody?.phase ?? "unknown";
            const details = parsedBody?.details;
            setAddDebug(
              [
                `処理段階：${phase}`,
                details?.status ? `HTTP：${String(details.status)}` : null,
                details?.githubMessage
                  ? `GitHub：${String(details.githubMessage)}`
                  : null,
                `失敗バッチ：${batchIndex + 1} / ${batchCount}`,
                details?.elapsedMs
                  ? `処理時間：${String(details.elapsedMs)}ms`
                  : null,
                details?.payloadByteLength
                  ? `request payload：${String(details.payloadByteLength)} bytes`
                  : null,
              ]
                .filter(Boolean)
                .join("\n"),
            );

            setAddProgress((current) => {
              if (!current || current.processId !== processId) return current;
              const batchStatuses = [...current.batchStatuses];
              batchStatuses[batchIndex] = "failed";
              return {
                ...current,
                status: "partial",
                batchStatuses,
                processedCount: Math.min(
                  totalSelected,
                  batchIndex * ADD_BATCH_SIZE,
                ),
              };
            });

            break;
          }

          if (!parsedBody?.summary) {
            failedBatchIndex = batchIndex;
            remainingCandidates = batches
              .slice(batchIndex)
              .flatMap((entries) => entries);
            setAddDebug("サーバーから空の応答が返されました。");
            setAddProgress((current) => {
              if (!current || current.processId !== processId) return current;
              const batchStatuses = [...current.batchStatuses];
              batchStatuses[batchIndex] = "failed";
              return { ...current, status: "partial", batchStatuses };
            });
            break;
          }

          addedCount += parsedBody.summary.addedCount;
          catalogDuplicateCount += parsedBody.summary.catalogDuplicateCount;
          selectionDuplicateCount +=
            parsedBody.summary.selectionDuplicateCount;
          invalidCount += parsedBody.summary.invalidCount;
          if (typeof parsedBody.summary.catalogCountAfter === "number") {
            catalogCountAfter = parsedBody.summary.catalogCountAfter;
          }
          for (const file of parsedBody.summary.updatedShardFiles ?? []) {
            updatedShardFiles.add(file);
          }
          for (const file of parsedBody.summary.newShardFiles ?? []) {
            newShardFiles.add(file);
          }
          if ((parsedBody.summary.addedCount ?? 0) > 0) {
            commitCount += 1;
          }
          if (parsedBody.addedContentIds?.length) {
            allAddedIds.push(...parsedBody.addedContentIds);
          }

          setAddProgress((current) => {
            if (!current || current.processId !== processId) return current;
            const batchStatuses = [...current.batchStatuses];
            batchStatuses[batchIndex] = "done";
            return {
              ...current,
              batchStatuses,
              processedCount: Math.min(
                totalSelected,
                (batchIndex + 1) * ADD_BATCH_SIZE,
              ),
            };
          });
        }

        if (allAddedIds.length > 0) {
          const addedIdSet = new Set(
            allAddedIds.map((id) => id.toLowerCase()),
          );
          setCandidates((current) =>
            current.filter(
              (candidate) =>
                !addedIdSet.has(
                  getCandidateSelectionId(candidate).toLowerCase(),
                ),
            ),
          );
          setSelectedIds((current) => {
            const next = new Set(current);
            for (const id of addedIdSet) next.delete(id);
            return next;
          });
        }

        // サイトマップ更新は本番反映時に1回のみ。追加時点では実行しない。
        const sitemap: SitemapPostImportResult | null = null;
        void sitemap;

        const duplicateCount =
          catalogDuplicateCount + selectionDuplicateCount;

        if (failedBatchIndex != null) {
          setPendingResumeCandidates(remainingCandidates);
          setAddError(
            [
              `${totalSelected}件の一括追加に失敗しました。`,
              `${addedCount.toLocaleString()}件は作業用データへ追加済みです。`,
              `残り${remainingCandidates.length.toLocaleString()}件から再開できます。`,
            ].join("\n"),
          );
          setAddMessage(
            [
              "一部を作業用ブランチへ保存しました。",
              "本番サイトにはまだ反映されていません。",
            ].join("\n"),
          );
          setAddSummary({
            addedCount,
            duplicateCount,
            invalidCount,
            catalogCount: catalogCountAfter,
            updatedShardFiles: [...updatedShardFiles],
            newShardFiles: [...newShardFiles],
            batchCount,
            commitCount,
            sitemap: null,
          });
          setAddProgress((current) =>
            current && current.processId === processId
              ? { ...current, status: "partial" }
              : current,
          );
          return;
        }

        setAddProgress((current) =>
          current && current.processId === processId
            ? {
                ...current,
                status: "done",
                processedCount: totalSelected,
              }
            : current,
        );

        const messageLines = [
          options?.resume
            ? "残り作品を作業用データへ追加しました。"
            : `${addedCount.toLocaleString()}件を作業用データへ追加しました。`,
          "本番サイトにはまだ反映されていません。",
          "続けて作品を追加するか、最後に『本番反映・デプロイ』を実行してください。",
          `選択：${totalSelected.toLocaleString()}件`,
          `追加成功：${addedCount.toLocaleString()}件`,
          `掲載済み：${catalogDuplicateCount.toLocaleString()}件`,
          selectionDuplicateCount > 0
            ? `重複：${selectionDuplicateCount.toLocaleString()}件`
            : null,
          `無効：${invalidCount.toLocaleString()}件`,
          `処理バッチ：${batchCount}回`,
          `GitHub commit：${commitCount}回`,
          catalogCountAfter != null
            ? `現在の総作品数：${catalogCountAfter.toLocaleString()}件`
            : null,
        ].filter(Boolean);

        setAddMessage(messageLines.join("\n"));
        setAddSummary({
          addedCount,
          duplicateCount,
          invalidCount,
          catalogCount: catalogCountAfter,
          updatedShardFiles: [...updatedShardFiles],
          newShardFiles: [...newShardFiles],
          batchCount,
          commitCount,
          sitemap: null,
        });
      } catch (error) {
        console.error("[add-selected] failed", {
          error,
          stack: error instanceof Error ? error.stack : undefined,
        });
        setAddError(
          error instanceof Error
            ? error.message
            : "カタログの更新に失敗しました。追加は確定していません。",
        );
      } finally {
        if (activeAddProcessIdRef.current === processId) {
          activeAddProcessIdRef.current = null;
        }
        setIsAddingWorks(false);
      }
    },
    [],
  );

  const handleAddSelected = useCallback(async () => {
    const selectedCandidates = candidates.filter((candidate) =>
      selectedIds.has(getCandidateSelectionId(candidate)),
    );
    await runAddBatches(selectedCandidates);
  }, [candidates, selectedIds, runAddBatches]);

  const handleResumeAdd = useCallback(async () => {
    if (!pendingResumeCandidates || pendingResumeCandidates.length === 0) {
      setAddError("再開できる未処理作品がありません。");
      return;
    }
    await runAddBatches(pendingResumeCandidates, { resume: true });
  }, [pendingResumeCandidates, runAddBatches]);

  const handleRefreshWorks = useCallback(async () => {
    setRefreshError(null);
    setRefreshMessage(null);
    setIsRefreshingWorks(true);

    try {
      const response = await fetch("/api/admin/import/refresh-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchSize: refreshBatchSize,
          prioritizeSale: refreshPrioritizeSale,
          prioritizeStale: refreshPrioritizeStale,
          prioritizePopular: refreshPrioritizePopular,
        }),
      });

      const responseText = await response.text();
      type RefreshResponseBody = {
        success?: boolean;
        message?: string;
        error?: string;
        summary?: CatalogRefreshBatchSummary;
        state?: CatalogRefreshState;
      };

      let payload: RefreshResponseBody | null = null;

      if (responseText.trim()) {
        payload = JSON.parse(responseText) as RefreshResponseBody;
      }

      const requestFailed =
        !response.ok || (payload !== null && payload.success === false);

      if (requestFailed) {
        throw new Error(
          payload?.message ??
            payload?.error ??
            `掲載済み作品の更新に失敗しました（HTTP ${response.status}）`,
        );
      }

      if (!payload) {
        throw new Error("サーバーから空の応答が返されました。");
      }

      setRefreshMessage(payload.message ?? "更新が完了しました。");
      if (payload.summary) setRefreshSummary(payload.summary);
      if (payload.state) setRefreshState(payload.state);
    } catch (error) {
      console.error("[import] refresh works failed", error);
      setRefreshError(
        error instanceof Error
          ? error.message
          : "掲載済み作品の更新に失敗しました。",
      );
    } finally {
      setIsRefreshingWorks(false);
    }
  }, [
    refreshBatchSize,
    refreshPrioritizePopular,
    refreshPrioritizeSale,
    refreshPrioritizeStale,
  ]);

  const selectPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const candidate of pageCandidates) {
        next.add(getCandidateSelectionId(candidate));
      }
      return next;
    });
  }, [pageCandidates]);

  const selectAllCandidates = useCallback(() => {
    setSelectedIds(
      new Set(candidates.map((candidate) => getCandidateSelectionId(candidate))),
    );
  }, [candidates]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectByPredicate = useCallback(
    (predicate: (candidate: FetchedImportCandidate) => boolean) => {
      setSelectedIds(
        new Set(
          candidates
            .filter(predicate)
            .map((candidate) => getCandidateSelectionId(candidate)),
        ),
      );
    },
    [candidates],
  );

  const toggleCandidate = useCallback(
    (contentId: string, selected: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (selected) {
          next.add(contentId);
        } else {
          next.delete(contentId);
        }
        return next;
      });
    },
    [],
  );

  const applyNextOffsetToInput = useCallback(() => {
    if (summary?.sort === fetchSort) {
      setStartOffsetInput(String(summary.nextOffset));
      return;
    }
    const stored = readStoredOffset(fetchSort);
    if (stored != null) {
      setStartOffsetInput(String(stored));
    }
  }, [summary, fetchSort]);

  const resetOffsetToZero = useCallback(() => {
    const previous = resolveStartOffset();
    setStartOffsetInput("0");
    setPreviousOffset(previous);
    writeStoredOffset(fetchSort, 0, { previousOffset: previous });
  }, [fetchSort, resolveStartOffset]);

  const restorePreviousOffset = useCallback(() => {
    const storedPrevious = readStoredPreviousOffset(fetchSort);
    const target =
      previousOffset != null
        ? previousOffset
        : storedPrevious != null
          ? storedPrevious
          : null;
    if (target != null) {
      setStartOffsetInput(String(target));
    }
  }, [previousOffset, fetchSort]);

  const handleFetchSortChange = useCallback((next: AdultImportSortMode) => {
    setFetchSort(next);
    writeStoredSortMode(next);
    syncSortQueryParam(next);
    const stored = readStoredOffset(next);
    const storedPrevious = readStoredPreviousOffset(next);
    setStartOffsetInput(stored != null && stored > 0 ? String(stored) : "");
    setPreviousOffset(storedPrevious);
  }, []);

  const toggleFilter = useCallback((key: ImportFilterKey) => {
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setPage(1);
  }, []);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        GitHub 連携または作業用ブランチ（ADULT_CATALOG_WORKING_BRANCH）の設定が未完了です。
        カタログの追加はできません。
      </div>
    );
  }

  if (!dmmConfigured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        FANZA API の設定が未完了です。候補の取得はできません。
      </div>
    );
  }

  const fetchSortLabel = getAdultImportSortLabel(fetchSort);
  const resultSortLabel = summary?.sort
    ? getAdultImportSortLabel(summary.sort)
    : fetchSortLabel;
  const fetchDescription =
    fetchSort === "new"
      ? "FANZA新着順から、アダルト図鑑に未掲載の新しい作品を優先して取得します。"
      : "FANZA人気順から、アダルト図鑑に未掲載の作品を優先して取得します。";
  const fetchButtonLabel =
    fetchSort === "new" ? "未掲載の新着作品を取得" : "未掲載の人気作品を取得";
  const fetchingHint =
    fetchSort === "new"
      ? `掲載済み作品を除外しながら、未掲載の新着作品候補を探しています…`
      : `掲載済み作品を除外しながら、未掲載の人気作品候補を探しています…`;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">
          A. 未掲載作品を取得・追加
        </h2>
        <p className="mt-2 text-sm text-muted">
          FANZA人気順または新着順から未掲載作品だけを候補取得し、選択した作品を作業用ブランチへ追加します。
          {githubConfigured
            ? " 本番反映は上部の『本番反映・デプロイ』から行います。"
            : " （ローカル書き込みモード）"}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">① 候補取得</h2>
        <p className="mt-2 text-sm text-muted">{fetchDescription}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted">並び順</span>
            <select
              className={SELECT_CONTROL_CLASS}
              value={fetchSort}
              onChange={(event) =>
                handleFetchSortChange(event.target.value as AdultImportSortMode)
              }
              disabled={isAddingWorks || isFetchingCandidates}
            >
              {ADULT_IMPORT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">
              開始offset（{fetchSortLabel}）
            </span>
            <input
              type="number"
              min={0}
              className={SELECT_CONTROL_CLASS}
              value={startOffsetInput}
              onChange={(event) => setStartOffsetInput(event.target.value)}
              placeholder={String(readStoredOffset(fetchSort) ?? 0)}
              disabled={isAddingWorks}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">未掲載候補の目標件数</span>
            <select
              className={SELECT_CONTROL_CLASS}
              value={requestedCount}
              onChange={(event) =>
                setRequestedCount(Number(event.target.value))
              }
              disabled={isAddingWorks}
            >
              {IMPORT_FETCH_REQUEST_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}件
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyNextOffsetToInput}
            disabled={isAddingWorks}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            次回offsetを入力
          </button>
          <button
            type="button"
            onClick={resetOffsetToZero}
            disabled={isAddingWorks}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            0に戻す
          </button>
          <button
            type="button"
            onClick={restorePreviousOffset}
            disabled={
              isAddingWorks ||
              (previousOffset == null &&
                readStoredPreviousOffset(fetchSort) == null)
            }
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            前回offsetに戻す
          </button>
        </div>
        <button
          type="button"
          onClick={handleFetchCandidates}
          disabled={isFetchingCandidates || isAddingWorks}
          className="mt-4 min-h-[44px] w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          {isFetchingCandidates
            ? `${fetchSortLabel}を確認中…（目標: ${requestedCount}件）`
            : fetchButtonLabel}
        </button>
        {isFetchingCandidates ? (
          <p className="mt-2 text-sm text-muted">{fetchingHint}</p>
        ) : null}
        {fetchError ? (
          <p className="mt-3 text-sm text-red-600">{fetchError}</p>
        ) : null}
      </section>

      {summary ? (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">② 取得結果サマリー</h2>
          <p className="mt-2 text-sm font-medium text-foreground">
            取得元：{resultSortLabel}
          </p>
          {summary.message ? (
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">
              {summary.message}
            </p>
          ) : null}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">API取得件数</dt>
              <dd>{summary.apiFetchedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">既掲載除外件数</dt>
              <dd>{summary.publishedExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">重複除外件数</dt>
              <dd>{summary.duplicateExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">未掲載候補件数</dt>
              <dd>{summary.candidateCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">開始offset</dt>
              <dd>{summary.startOffset.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted">次回offset</dt>
              <dd>{summary.nextOffset.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted">取得要求候補</dt>
              <dd>{summary.requestedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">catalog掲載数</dt>
              <dd>{summary.catalogCount.toLocaleString()}件</dd>
            </div>
            {summary.popularityRangeMin != null &&
            summary.popularityRangeMax != null ? (
              <div className="sm:col-span-2">
                <dt className="text-muted">
                  {summary.sort === "new" ? "新着走査範囲" : "人気順位範囲"}
                </dt>
                <dd>
                  {summary.popularityRangeMin.toLocaleString()}位〜
                  {summary.popularityRangeMax.toLocaleString()}位
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">③ 選択・一括追加</h2>
        <p className="mt-2 text-sm text-muted">
          候補総数：{candidates.length.toLocaleString()}件 / 表示中：
          {pageCandidates.length.toLocaleString()}件 / 選択中：
          {selectedCount.toLocaleString()}件
        </p>
        {selectedCount > 0 ? (
          <p className="mt-2 text-sm text-foreground">
            {ADD_BATCH_SIZE}件ずつ作業用ブランチへ追加します（1操作あたり最大1コミットを目標） / 予定バッチ数：
            {plannedBatchCount(selectedCount)}回
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectPage}
            disabled={isAddingWorks || pageCandidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            このページを選択
          </button>
          <button
            type="button"
            onClick={selectAllCandidates}
            disabled={isAddingWorks || candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            全候補を選択
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isAddingWorks || selectedCount === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasImage)}
            disabled={isAddingWorks || candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            画像ありだけ選択
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasActress)}
            disabled={isAddingWorks || candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            女優ありだけ選択
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasPrice)}
            disabled={isAddingWorks || candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            価格ありだけ選択
          </button>
        </div>
        <button
          type="button"
          onClick={handleAddSelected}
          disabled={isAddingWorks || isFetchingCandidates || selectedCount === 0}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isAddingWorks ? "追加中..." : "選択した作品を追加"}
        </button>

        {addProgress && addProgress.status === "running" ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="font-medium">
              {addProgress.totalSelected.toLocaleString()}件を追加中
            </p>
            <p className="mt-1 text-muted">
              バッチ {addProgress.currentBatch} / {addProgress.batchCount}
              {" ・ "}
              {addProgress.processedCount.toLocaleString()} /{" "}
              {addProgress.totalSelected.toLocaleString()}件処理済み
              {" ・ "}
              {Math.round(
                (addProgress.processedCount / addProgress.totalSelected) * 100,
              )}
              %
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded bg-white">
              <div
                className="h-full bg-accent transition-all"
                style={{
                  width: `${Math.round(
                    (addProgress.processedCount / addProgress.totalSelected) *
                      100,
                  )}%`,
                }}
              />
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {addProgress.batchStatuses.map((status, index) => (
                <li key={`batch-${index + 1}`}>
                  バッチ{index + 1}：
                  {status === "done"
                    ? "完了"
                    : status === "running"
                      ? "処理中"
                      : status === "failed"
                        ? "失敗"
                        : "待機"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {addMessage ? (
          <div className="mt-3 space-y-3">
            <p className="whitespace-pre-line text-sm text-green-700">
              {addMessage}
            </p>
            {addSummary ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-green-800">追加成功</dt>
                    <dd className="font-medium">
                      {addSummary.addedCount.toLocaleString()}件
                    </dd>
                  </div>
                  <div>
                    <dt className="text-green-800">掲載済み・重複</dt>
                    <dd className="font-medium">
                      {addSummary.duplicateCount.toLocaleString()}件
                    </dd>
                  </div>
                  <div>
                    <dt className="text-green-800">無効</dt>
                    <dd className="font-medium">
                      {addSummary.invalidCount.toLocaleString()}件
                    </dd>
                  </div>
                  <div>
                    <dt className="text-green-800">処理バッチ</dt>
                    <dd className="font-medium">{addSummary.batchCount}回</dd>
                  </div>
                  <div>
                    <dt className="text-green-800">GitHub commit</dt>
                    <dd className="font-medium">{addSummary.commitCount}回</dd>
                  </div>
                  {addSummary.catalogCount != null ? (
                    <div>
                      <dt className="text-green-800">現在の総作品数</dt>
                      <dd className="font-medium">
                        {addSummary.catalogCount.toLocaleString()}件
                      </dd>
                    </div>
                  ) : null}
                  {addSummary.updatedShardFiles.length > 0 ? (
                    <div>
                      <dt className="text-green-800">更新shard</dt>
                      <dd className="font-medium">
                        {addSummary.updatedShardFiles.join(", ")}
                      </dd>
                    </div>
                  ) : null}
                  {addSummary.newShardFiles.length > 0 ? (
                    <div>
                      <dt className="text-green-800">新規shard</dt>
                      <dd className="font-medium">
                        {addSummary.newShardFiles.join(", ")}
                      </dd>
                    </div>
                  ) : null}
                  {addSummary.sitemap ? (
                    <>
                      <div>
                        <dt className="text-green-800">サイトマップ</dt>
                        <dd className="font-medium">
                          {addSummary.sitemap.sitemapUpdated
                            ? "更新済み"
                            : "更新失敗（SEO管理画面から再実行）"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-green-800">Google再送信</dt>
                        <dd className="font-medium">
                          {addSummary.sitemap.googleSubmission.submitted
                            ? "送信済み"
                            : addSummary.sitemap.googleSubmission.reason ===
                                "recently-submitted"
                              ? "前回送信から30分以内のため省略"
                              : addSummary.sitemap.googleSubmission.dryRun
                                ? "ローカルdry-run"
                                : "未送信"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
                <Link
                  href="/admin/seo"
                  className="mt-3 inline-block text-sm text-accent underline"
                >
                  SEO管理画面で確認
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        {addError ? (
          <div className="mt-3 space-y-2">
            <p className="whitespace-pre-line text-sm text-red-600">{addError}</p>
            {pendingResumeCandidates && pendingResumeCandidates.length > 0 ? (
              <button
                type="button"
                onClick={handleResumeAdd}
                disabled={isAddingWorks}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                残り{pendingResumeCandidates.length.toLocaleString()}件を再開
              </button>
            ) : null}
          </div>
        ) : null}
        {addDebug ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">
              開発者詳細
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs text-muted">
              {addDebug}
            </pre>
          </details>
        ) : null}
      </section>

      <section
        className={`rounded-xl border border-border bg-white p-4 shadow-sm ${
          isAddingWorks ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <h2 className="text-sm font-bold text-foreground">④ フィルター・並び替え</h2>
        <div className="mt-4 space-y-4">
          <ImportFilterBar
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            onClearFilters={() => {
              setActiveFilters(new Set());
              setPage(1);
            }}
          />
          <ImportSortBar
            sort={sort}
            page={currentPage}
            totalPages={totalPages}
            totalCount={filteredCandidates.length}
            onSortChange={(nextSort) => {
              setSort(nextSort);
              setPage(1);
            }}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        </div>
      </section>

      <section ref={candidateListRef} className="space-y-4">
        <h2 className="text-sm font-bold text-foreground">⑤ 候補一覧</h2>
        {pageCandidates.length === 0 ? (
          <p className="text-sm text-muted">
            候補がありません。「候補を取得」から FANZA 作品を取得してください。
          </p>
        ) : (
          pageCandidates.map((candidate) => {
            const contentId = getCandidateSelectionId(candidate);
            return (
              <ImportCandidateCard
                key={contentId}
                item={candidate.item}
                source="fanza-rank"
                sourceLabel={formatImportSourceLabel("fanza-rank")}
                selected={selectedIds.has(contentId)}
                isAdded={false}
                popularityRank={
                  candidate.candidateMeta?.absolutePopularityPosition ??
                  candidate.rankPosition
                }
                comparePool={candidates.map((entry) => entry.item)}
                onSelectedChange={(id, selected, item: DmmItem) => {
                  void item;
                  toggleCandidate(id, selected);
                }}
                onExclude={async () => {
                  setCandidates((current) =>
                    current.filter(
                      (entry) =>
                        getCandidateSelectionId(entry) !== contentId,
                    ),
                  );
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    next.delete(contentId);
                    return next;
                  });
                }}
              />
            );
          })
        )}
      </section>

      <section className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">
          B. 掲載済み作品の最新情報更新
        </h2>
        <p className="mt-2 text-sm text-muted">
          カタログに存在する作品だけを FANZA API から再取得し、価格・セール・販売状態などを更新します。新規作品は追加しません。
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted">掲載作品数</dt>
            <dd>{(refreshCatalogCount ?? summary?.catalogCount ?? 0).toLocaleString()}件</dd>
          </div>
          <div>
            <dt className="text-muted">最終更新日時</dt>
            <dd>{refreshState?.lastCompletedAt ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">前回更新件数</dt>
            <dd>
              {refreshState?.lastBatchSummary?.updatedCount?.toLocaleString() ??
                "—"}
              件
            </dd>
          </div>
          <div>
            <dt className="text-muted">次回開始位置</dt>
            <dd>{(refreshState?.nextRefreshOffset ?? 0).toLocaleString()}</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">1回の更新件数</span>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              value={refreshBatchSize}
              onChange={(event) =>
                setRefreshBatchSize(Number(event.target.value))
              }
            >
              {CATALOG_REFRESH_BATCH_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}件
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={refreshPrioritizeSale}
                onChange={(event) =>
                  setRefreshPrioritizeSale(event.target.checked)
                }
              />
              セール作品を優先
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={refreshPrioritizeStale}
                onChange={(event) =>
                  setRefreshPrioritizeStale(event.target.checked)
                }
              />
              更新日時が古い順
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={refreshPrioritizePopular}
                onChange={(event) =>
                  setRefreshPrioritizePopular(event.target.checked)
                }
              />
              人気作品を優先
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefreshWorks}
          disabled={
            isRefreshingWorks || isAddingWorks || isFetchingCandidates
          }
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isRefreshingWorks
            ? `掲載済み作品を更新中…（${refreshBatchSize}件）`
            : `既存作品${refreshBatchSize}件を更新`}
        </button>
        {refreshMessage ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-foreground">
            {refreshMessage}
          </pre>
        ) : null}
        {refreshError ? (
          <p className="mt-3 text-sm text-red-600">{refreshError}</p>
        ) : null}
        {refreshSummary ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">更新対象</dt>
              <dd>{refreshSummary.targetCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">更新成功</dt>
              <dd>{refreshSummary.updatedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">価格変更</dt>
              <dd>{refreshSummary.priceChangedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">セール開始</dt>
              <dd>{refreshSummary.saleStartedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">セール終了</dt>
              <dd>{refreshSummary.saleEndedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">変更なし</dt>
              <dd>{refreshSummary.unchangedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">取得不可</dt>
              <dd>{refreshSummary.unavailableCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">取得失敗</dt>
              <dd>{refreshSummary.failedCount.toLocaleString()}件</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 p-3 shadow-lg md:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm">
            選択中 <span className="font-bold">{selectedCount}</span> 件
          </p>
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={isAddingWorks || isFetchingCandidates || selectedCount === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isAddingWorks ? "追加中..." : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}
