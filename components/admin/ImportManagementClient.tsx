"use client";

import { useCallback, useMemo, useState } from "react";
import { ImportBulkConfirmModal } from "@/components/admin/ImportBulkConfirmModal";
import { ImportBulkSnsPanel } from "@/components/admin/ImportBulkSnsPanel";
import { ImportBulkToolbar } from "@/components/admin/ImportBulkToolbar";
import { ImportCandidateCard } from "@/components/admin/ImportCandidateCard";
import { ImportFilterBar } from "@/components/admin/ImportFilterBar";
import { ImportSortBar } from "@/components/admin/ImportSortBar";
import { ImportSummaryBar } from "@/components/admin/ImportSummaryBar";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import { formatImportSourceLabel } from "@/lib/admin/import-source-labels";
import {
  getImportQualityFlags,
  summarizeImportSelection,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import type { DmmItem } from "@/lib/dmm/types";

type ImportManagementInitialData = ImportCandidatesListResult & {
  configured: boolean;
  dmmConfigured: boolean;
  message?: string;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<ImportFilterKey>>(
    new Set(),
  );
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<DmmItem[]>([]);
  const [bulkAddMessage, setBulkAddMessage] = useState<string | null>(null);
  const [bulkAddError, setBulkAddError] = useState<string | null>(null);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCandidates = useMemo(
    () =>
      data.candidates.filter(
        (candidate) => !addedIds.has(candidate.contentId),
      ),
    [data.candidates, addedIds],
  );

  const selectedCandidates = useMemo(
    () =>
      visibleCandidates.filter((candidate) =>
        selectedIds.has(candidate.contentId),
      ),
    [visibleCandidates, selectedIds],
  );

  const confirmSummary = useMemo(
    () =>
      summarizeImportSelection(
        selectedCandidates.map((candidate) => candidate.item),
      ),
    [selectedCandidates],
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
      setData(payload);
      setPage(payload.pagination.page);
      setSort(targetSort);
      setSelectedIds(new Set());
    },
    [page, sort, activeFilters],
  );

  const handleMarkAdded = useCallback(
    async (contentId: string) => {
      setAddedIds((current) => new Set([...current, contentId]));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(contentId);
        return next;
      });

      try {
        await loadCandidates();
      } catch {
        // 一覧再取得失敗時も追加済み表示は維持
      }
    },
    [loadCandidates],
  );

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

        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(contentId);
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
    [loadCandidates],
  );

  const handleSelectedChange = useCallback(
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

  const handleSelectAll = useCallback(() => {
    setSelectedIds(
      new Set(
        visibleCandidates
          .filter((candidate) => !addedIds.has(candidate.contentId))
          .map((candidate) => candidate.contentId),
      ),
    );
  }, [visibleCandidates, addedIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSelectByFlag = useCallback(
    (flag: ImportFilterKey) => {
      setSelectedIds(
        new Set(
          visibleCandidates
            .filter((candidate) => {
              if (addedIds.has(candidate.contentId)) return false;
              return getImportQualityFlags(candidate.item)[flag];
            })
            .map((candidate) => candidate.contentId),
        ),
      );
    },
    [visibleCandidates, addedIds],
  );

  async function handleCollect() {
    setIsCollecting(true);
    setError(null);
    setCollectMessage(null);

    try {
      const response = await fetch("/api/admin/import/collect-candidates", {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        collectedCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "候補の収集に失敗しました。");
      }

      setCollectMessage(payload.message ?? "候補を収集しました。");
      await loadCandidates({ nextPage: 1 });
    } catch (collectError) {
      setError(
        collectError instanceof Error
          ? collectError.message
          : "候補の収集に失敗しました。",
      );
    } finally {
      setIsCollecting(false);
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
      await loadCandidates({ nextPage });
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

  function handleBulkAddRequest() {
    setBulkAddError(null);

    if (selectedCandidates.length === 0) {
      setBulkAddError("追加する作品を選択してください。");
      return;
    }

    if (selectedCandidates.length > IMPORT_BULK_ADD_MAX) {
      setBulkAddError("1回で追加できるのは100件までです");
      return;
    }

    setShowConfirmModal(true);
  }

  async function handleBulkAddConfirm() {
    if (selectedCandidates.length > IMPORT_BULK_ADD_MAX) {
      setBulkAddError("1回で追加できるのは100件までです");
      setShowConfirmModal(false);
      return;
    }

    setIsBulkAdding(true);
    setBulkAddError(null);

    try {
      const response = await fetch("/api/admin/import/bulk-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          works: selectedCandidates.map((candidate) => ({
            contentId: candidate.contentId,
            item: candidate.item,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        addedContentIds?: string[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "一括追加に失敗しました。");
      }

      const addedContentIds = payload.addedContentIds ?? [];
      setAddedIds((current) => new Set([...current, ...addedContentIds]));
      setRecentlyAddedItems(
        selectedCandidates
          .filter((candidate) => addedContentIds.includes(candidate.contentId))
          .map((candidate) => candidate.item),
      );
      setSelectedIds(new Set());
      setBulkAddMessage(
        payload.message ??
          `${addedContentIds.length}件を追加しました。Vercelの反映まで数分かかります。`,
      );
      setShowConfirmModal(false);
      await loadCandidates();
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
        GitHub 連携（GITHUB_TOKEN / GITHUB_OWNER）が未設定のため、候補データの保存・追加ができません。
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
    <div className="space-y-6">
      <ImportSummaryBar
        summary={data.summary}
        filteredCount={data.pagination.totalCount}
        isCollecting={isCollecting}
        onCollect={handleCollect}
      />

      {data.message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {collectMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
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
          {bulkAddError}
        </div>
      ) : null}

      {recentlyAddedItems.length > 0 ? (
        <ImportBulkSnsPanel items={recentlyAddedItems} />
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

      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted">
          読み込み中...
        </div>
      ) : visibleCandidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
          表示できる候補作品がありません。「候補を収集」で FANZA から未掲載作品を蓄積してください。
        </div>
      ) : (
        <>
          <ImportBulkToolbar
            selectedCount={selectedCandidates.length}
            filteredCount={visibleCandidates.length}
            isBulkAdding={isBulkAdding}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onSelectByFlag={handleSelectByFlag}
            onBulkAdd={handleBulkAddRequest}
          />

          <div className="space-y-4">
            {visibleCandidates.map((candidate) => (
              <ImportCandidateCard
                key={candidate.contentId}
                item={candidate.item}
                source={candidate.source}
                sourceLabel={formatImportSourceLabel(candidate.source)}
                selected={selectedIds.has(candidate.contentId)}
                isAdded={addedIds.has(candidate.contentId)}
                comparePool={comparePool}
                onSelectedChange={handleSelectedChange}
                onExclude={handleExclude}
                onMarkAdded={handleMarkAdded}
              />
            ))}
          </div>
        </>
      )}

      {showConfirmModal ? (
        <ImportBulkConfirmModal
          summary={confirmSummary}
          isSubmitting={isBulkAdding}
          onConfirm={handleBulkAddConfirm}
          onCancel={() => setShowConfirmModal(false)}
        />
      ) : null}
    </div>
  );
}
