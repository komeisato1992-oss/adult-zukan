"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImportCandidateCard } from "@/components/admin/ImportCandidateCard";
import { ImportFilterBar } from "@/components/admin/ImportFilterBar";
import { ImportSortBar } from "@/components/admin/ImportSortBar";
import {
  IMPORT_FETCH_REQUEST_DEFAULT,
  IMPORT_FETCH_REQUEST_OPTIONS,
  IMPORT_PAGE_SIZE,
} from "@/lib/admin/import-constants";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import {
  getCandidateSelectionId,
  readCandidatesSession,
  readStoredOffset,
  writeCandidatesSession,
  writeStoredOffset,
  type ImportCandidatesSession,
} from "@/lib/admin/import-session-storage";
import type {
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import { formatImportSourceLabel } from "@/lib/admin/import-source-labels";
import {
  matchesImportFilters,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import { parseJsonResponseBody } from "@/lib/admin/bulk-add-safe";
import type { DmmItem } from "@/lib/dmm/types";

type ImportManagementClientProps = {
  configured: boolean;
  dmmConfigured: boolean;
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
    case "collectedAt-desc":
    default:
      return next.sort((a, b) => {
        const rankA = a.rankPosition ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.rankPosition ?? Number.MAX_SAFE_INTEGER;
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
}: ImportManagementClientProps) {
  const restoredSession = useMemo(() => readCandidatesSession(), []);

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
  const [sort, setSort] = useState<ImportCandidateSortKey>("seoScore-desc");
  const [page, setPage] = useState(1);
  const [requestedCount, setRequestedCount] = useState(
    IMPORT_FETCH_REQUEST_DEFAULT,
  );
  const [startOffsetInput, setStartOffsetInput] = useState("");
  const [previousOffset, setPreviousOffset] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);
  const [isAddingWorks, setIsAddingWorks] = useState(false);
  const candidateListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (candidates.length === 0) return;
    writeCandidatesSession({
      sort: "popular",
      candidates,
      summary,
    });
  }, [candidates, summary]);

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

    const stored = readStoredOffset("popular");
    return stored ?? 0;
  }, [startOffsetInput]);

  const handleFetchCandidates = useCallback(async () => {
    setFetchError(null);
    setAddMessage(null);
    setAddError(null);
    setIsFetchingCandidates(true);

    const startOffset = resolveStartOffset();
    setPreviousOffset(startOffset);

    try {
      const response = await fetch("/api/admin/import/fetch-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort: "popular",
          offset: startOffset,
          requestedCount,
        }),
      });

      const payload = await parseJsonResponseBody<{
        candidates?: FetchedImportCandidate[];
        summary?: FetchImportCandidatesSummary;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "候補の取得に失敗しました。カタログは変更されていません。",
        );
      }

      const nextCandidates = payload.candidates ?? [];
      const nextSummary = payload.summary ?? null;

      setCandidates(nextCandidates);
      setSummary(nextSummary);
      setSelectedIds(new Set());
      setPage(1);

      if (nextSummary) {
        writeStoredOffset("popular", nextSummary.nextOffset);
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
  }, [requestedCount, resolveStartOffset]);

  const handleAddSelected = useCallback(async () => {
    setAddError(null);
    setAddMessage(null);

    const selectedCandidates = candidates.filter((candidate) =>
      selectedIds.has(getCandidateSelectionId(candidate)),
    );

    if (selectedCandidates.length === 0) {
      setAddError("追加する作品が選択されていません。");
      return;
    }

    setIsAddingWorks(true);

    try {
      const works = selectedCandidates.map((candidate) => ({
        contentId: getCandidateSelectionId(candidate),
        item: candidate.item,
        sourcePopularityRank: candidate.rankPosition,
      }));

      const response = await fetch("/api/admin/import/add-selected-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ works }),
      });

      const payload = await parseJsonResponseBody<{
        success?: boolean;
        message?: string;
        addedContentIds?: string[];
        summary?: {
          addedCount: number;
          catalogDuplicateCount: number;
          selectionDuplicateCount: number;
          invalidCount: number;
        };
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "カタログの更新に失敗しました。追加は確定していません。",
        );
      }

      setAddMessage(payload.message ?? "追加が完了しました。");

      if (payload.addedContentIds && payload.addedContentIds.length > 0) {
        const addedIdSet = new Set(
          payload.addedContentIds.map((id) => id.toLowerCase()),
        );

        setCandidates((current) =>
          current.filter(
            (candidate) =>
              !addedIdSet.has(getCandidateSelectionId(candidate).toLowerCase()),
          ),
        );
        setSelectedIds((current) => {
          const next = new Set(current);
          for (const id of addedIdSet) {
            next.delete(id);
          }
          return next;
        });
      }
    } catch (error) {
      console.error("[import] add selected failed", error);
      setAddError(
        error instanceof Error
          ? error.message
          : "カタログの更新に失敗しました。追加は確定していません。",
      );
    } finally {
      setIsAddingWorks(false);
    }
  }, [candidates, selectedIds]);

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
    if (summary) {
      setStartOffsetInput(String(summary.nextOffset));
      return;
    }
    const stored = readStoredOffset("popular");
    if (stored != null) {
      setStartOffsetInput(String(stored));
    }
  }, [summary]);

  const resetOffsetToZero = useCallback(() => {
    setStartOffsetInput("0");
  }, []);

  const restorePreviousOffset = useCallback(() => {
    if (previousOffset != null) {
      setStartOffsetInput(String(previousOffset));
    }
  }, [previousOffset]);

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
        GitHub 連携の設定が未完了です。カタログの追加はできません。
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">① 候補取得</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="text-muted">並び順</span>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              value="popular"
              disabled
            >
              <option value="popular">人気順</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">開始offset</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              value={startOffsetInput}
              onChange={(event) => setStartOffsetInput(event.target.value)}
              placeholder={String(readStoredOffset("popular") ?? 0)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">取得件数</span>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              value={requestedCount}
              onChange={(event) =>
                setRequestedCount(Number(event.target.value))
              }
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
            className="rounded-lg border border-border px-3 py-1.5 text-xs"
          >
            次回offsetを入力
          </button>
          <button
            type="button"
            onClick={resetOffsetToZero}
            className="rounded-lg border border-border px-3 py-1.5 text-xs"
          >
            0に戻す
          </button>
          <button
            type="button"
            onClick={restorePreviousOffset}
            disabled={previousOffset == null}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            前回offsetに戻す
          </button>
        </div>
        <button
          type="button"
          onClick={handleFetchCandidates}
          disabled={isFetchingCandidates || isAddingWorks}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isFetchingCandidates ? "候補を取得中..." : "候補を取得"}
        </button>
        {fetchError ? (
          <p className="mt-3 text-sm text-red-600">{fetchError}</p>
        ) : null}
      </section>

      {summary ? (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">② 取得結果サマリー</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">API取得件数</dt>
              <dd>{summary.apiFetchedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">掲載済み除外</dt>
              <dd>{summary.publishedExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">重複除外</dt>
              <dd>{summary.duplicateExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">無効除外</dt>
              <dd>{summary.invalidExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">画像なし除外</dt>
              <dd>{summary.imageMissingExcludedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">有効候補</dt>
              <dd>{summary.candidateCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">今回の開始offset</dt>
              <dd>{summary.startOffset.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted">次回offset</dt>
              <dd>{summary.nextOffset.toLocaleString()}</dd>
            </div>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectPage}
            disabled={pageCandidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            このページを選択
          </button>
          <button
            type="button"
            onClick={selectAllCandidates}
            disabled={candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            全候補を選択
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedCount === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasImage)}
            disabled={candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            画像ありだけ選択
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasActress)}
            disabled={candidates.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            女優ありだけ選択
          </button>
          <button
            type="button"
            onClick={() => selectByPredicate(candidateHasPrice)}
            disabled={candidates.length === 0}
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
        {addMessage ? (
          <p className="mt-3 whitespace-pre-line text-sm text-green-700">
            {addMessage}
          </p>
        ) : null}
        {addError ? (
          <p className="mt-3 text-sm text-red-600">{addError}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
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
