"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { ImportBulkConfirmSummary, ImportFilterKey } from "@/lib/admin/import-quality";
import { getImportQualityFlags } from "@/lib/admin/import-quality";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonCorrupt, setJsonCorrupt] = useState(Boolean(initialData.jsonCorrupt));
  const [isResettingJson, setIsResettingJson] = useState(false);
  const [resetJsonMessage, setResetJsonMessage] = useState<string | null>(null);

  const visibleCandidates = useMemo(
    () => data.candidates,
    [data.candidates],
  );

  const selectedCandidates = useMemo(
    () =>
      visibleCandidates.filter((candidate) =>
        selectedIds.has(candidate.contentId),
      ),
    [visibleCandidates, selectedIds],
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

      console.log("loaded candidates:", payload.candidates);
      console.log("filtered candidates:", payload.candidates);

      setData(payload);
      setPage(payload.pagination.page);
      setSort(targetSort);
      setSelectedIds(new Set());
    },
    [page, sort, activeFilters],
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/import/get-candidates?page=1", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || cancelled) return null;
        return (await response.json()) as ImportManagementInitialData;
      })
      .then((payload) => {
        if (!payload || cancelled) return;
        setData((current) => ({
          ...current,
          configured: payload.configured,
          dmmConfigured: payload.dmmConfigured,
        }));
      })
      .catch(() => {
        // 初期表示はサーバー描画の値を維持
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

      const payload = (await response.json()) as ImportManagementInitialData & {
        error?: string;
        success?: boolean;
        collectedCount?: number;
        displayedCount?: number;
        message?: string;
        candidates?: ImportCandidatesListResult["candidates"];
      };

      console.log("collect result:", payload);

      if (!response.ok) {
        throw new Error(payload.error ?? "候補の収集に失敗しました。");
      }

      if (Array.isArray(payload.candidates)) {
        setData((current) => ({
          ...current,
          summary: payload.summary ?? current.summary,
          candidates: payload.candidates ?? [],
          pagination: payload.pagination ?? current.pagination,
          message: undefined,
        }));
        setPage(payload.pagination?.page ?? 1);
        setSelectedIds(new Set());
        setActiveFilters(new Set());

        const displayedCount =
          payload.displayedCount ?? payload.pagination?.totalCount ?? payload.candidates.length;

        console.log("loaded candidates:", payload.candidates);
        console.log("filtered candidates:", payload.candidates);

        setCollectMessage(
          payload.message ??
            (displayedCount > 0
              ? `${displayedCount}件の候補を表示しました。`
              : "候補を収集しましたが、表示できる候補がありません。"),
        );
        return;
      }

      await loadCandidates({ nextPage: 1, nextFilters: new Set() });
      setCollectMessage(payload.message ?? "候補を収集しました。");
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

  async function handleBulkAddRequest() {
    setBulkAddError(null);

    if (selectedCandidates.length === 0) {
      setBulkAddError("追加する作品を選択してください。");
      return;
    }

    if (selectedCandidates.length > IMPORT_BULK_ADD_MAX) {
      setBulkAddError("1回で追加できるのは100件までです");
      return;
    }

    setIsPreviewLoading(true);

    try {
      const response = await fetch("/api/admin/import/bulk-add-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedWorks: selectedCandidates.map((candidate) => ({
            contentId: candidate.contentId,
            item: candidate.item,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
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
    if (selectedCandidates.length > IMPORT_BULK_ADD_MAX) {
      setBulkAddError("1回で追加できるのは100件までです");
      setShowConfirmModal(false);
      return;
    }

    setIsBulkAdding(true);
    setBulkAddError(null);

    try {
      const response = await fetch("/api/admin/import/bulk-add-works", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedWorks: selectedCandidates.map((candidate) => ({
            contentId: candidate.contentId,
            item: candidate.item,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        addedCount?: number;
        addedContentIds?: string[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "一括追加に失敗しました。");
      }

      const addedContentIds = payload.addedContentIds ?? [];
      setAddedIds((current) => new Set([...current, ...addedContentIds]));
      setRecentlyAddedIds((current) => new Set([...current, ...addedContentIds]));
      setRecentlyAddedItems(
        selectedCandidates
          .filter((candidate) => addedContentIds.includes(candidate.contentId))
          .map((candidate) => candidate.item),
      );
      setSelectedIds(new Set());
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
    <div className="space-y-6">
      <ImportSummaryBar
        summary={data.summary}
        visibleCount={data.summary.candidateCount}
        displayedCount={data.pagination.totalCount}
        isCollecting={isCollecting}
        onCollect={handleCollect}
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

      {!isLoading && visibleCandidates.length > 0 ? (
        <ImportBulkToolbar
          selectedCount={selectedCandidates.length}
          isBulkAdding={isBulkAdding || isPreviewLoading}
          onSelectAll={handleSelectAll}
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

      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted">
          読み込み中...
        </div>
      ) : visibleCandidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
          表示できる候補作品がありません。「候補を収集」で FANZA から未掲載作品を蓄積してください。
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCandidates.map((candidate) => (
            <ImportCandidateCard
              key={candidate.contentId}
              item={candidate.item}
              source={candidate.source}
              sourceLabel={formatImportSourceLabel(candidate.source)}
              selected={selectedIds.has(candidate.contentId)}
              isAdded={addedIds.has(candidate.contentId)}
              emphasizeSns={recentlyAddedIds.has(candidate.contentId)}
              comparePool={comparePool}
              onSelectedChange={handleSelectedChange}
              onExclude={handleExclude}
            />
          ))}
        </div>
      )}

      {showConfirmModal && confirmSummary ? (
        <ImportBulkConfirmModal
          summary={confirmSummary}
          isSubmitting={isBulkAdding}
          onConfirm={handleBulkAddConfirm}
          onCancel={() => {
            setShowConfirmModal(false);
            setConfirmSummary(null);
          }}
        />
      ) : null}
    </div>
  );
}
