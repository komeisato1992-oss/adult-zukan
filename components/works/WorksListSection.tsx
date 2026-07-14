"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { WorkListCard } from "@/components/works/WorkListCard";
import { WorksFilters } from "@/components/works/filters/WorksFilters";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  applyWorksFilterDraftToQuery,
  buildWorksQueryString,
  type WorkFilterOption,
  type WorksFilterDraft,
  type WorksListQueryState,
} from "@/lib/works/list-filters";
import type { WorkSortOption } from "@/lib/works/sort";
import {
  parseWorkSortParam,
  SALE_DEFAULT_WORK_SORT,
} from "@/lib/works/sort";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";
import { WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type WorksListSectionProps = {
  pageItems: WorkListCardItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  queryState: WorksListQueryState;
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
  sortOptions: WorkSortOption[];
  isSalePage?: boolean;
};

type WorksListGridProps = {
  items: WorkListCardItem[];
  priceDisplayMode?: "default" | "sale";
};

const WorksListGrid = memo(function WorksListGrid({
  items,
  priceDisplayMode = "default",
}: WorksListGridProps) {
  return (
    <div className={WORK_LIST_GRID_CLASSNAME}>
      {items.map((item) => (
        <WorkListCard
          key={item.contentId}
          item={item}
          priceDisplayMode={priceDisplayMode}
        />
      ))}
    </div>
  );
});

function mergeQuery(
  current: WorksListQueryState,
  patch: Partial<WorksListQueryState>,
  resetPage = false,
): WorksListQueryState {
  return {
    ...current,
    ...patch,
    page: resetPage ? "1" : patch.page ?? current.page ?? "1",
    price: patch.price ?? current.price ?? "all",
    date: patch.date ?? current.date ?? "all",
  };
}

export function WorksListSection({
  pageItems,
  totalItems,
  totalPages,
  currentPage,
  queryState,
  genreOptions,
  makerOptions,
  sortOptions,
  isSalePage = false,
}: WorksListSectionProps) {
  const router = useRouter();
  const currentSort =
    isSalePage && !queryState.sort?.trim()
      ? SALE_DEFAULT_WORK_SORT
      : parseWorkSortParam(queryState.sort);

  const navigate = useCallback(
    (next: WorksListQueryState) => {
      const qs = buildWorksQueryString(next);
      router.push(qs ? `/works?${qs}` : "/works");
    },
    [router],
  );

  const updateQuery = useCallback(
    (patch: Partial<WorksListQueryState>, resetPage = false) => {
      navigate(mergeQuery(queryState, patch, resetPage));
    },
    [navigate, queryState],
  );

  const applyFilters = useCallback(
    (draft: WorksFilterDraft, resetPage = true) => {
      const next = applyWorksFilterDraftToQuery(
        mergeQuery(queryState, {}, resetPage),
        draft,
      );
      navigate(next);
    },
    [navigate, queryState],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateQuery({ page: String(page) });
    },
    [updateQuery],
  );

  return (
    <>
      <div className="mb-5 space-y-4">
        <WorksFilters
          genreOptions={genreOptions}
          makerOptions={makerOptions}
          appliedQuery={queryState}
          onApply={applyFilters}
        />

        <WorksListControlGroup label="並び替え">
          <select
            id="works-sort"
            value={currentSort}
            onChange={(event) => updateQuery({ sort: event.target.value }, true)}
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[160px]"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </WorksListControlGroup>
      </div>

      <p className="mb-6 text-sm text-muted">
        {totalItems.toLocaleString("ja-JP")}件の作品が見つかりました。
        {totalPages > 1 ? `（${currentPage}/${totalPages}ページ目）` : null}
      </p>

      {pageItems.length > 0 ? (
        <>
          <WorksListGrid
            items={pageItems}
            priceDisplayMode={isSalePage ? "sale" : "default"}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/works"
            onPageChange={handlePageChange}
          />
        </>
      ) : (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          該当する作品が見つかりませんでした。別の条件でお試しください。
        </p>
      )}
    </>
  );
}
