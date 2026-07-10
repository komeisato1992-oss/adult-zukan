"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { WorkListCard } from "@/components/works/WorkListCard";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  buildWorksQueryString,
  WORK_DATE_FILTER_OPTIONS,
  WORK_PRICE_FILTER_OPTIONS,
  type WorkFilterOption,
  type WorksListQueryState,
} from "@/lib/works/list-filters";
import type { WorkSortOption } from "@/lib/works/sort";
import { parseWorkSortParam } from "@/lib/works/sort";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

type WorksListSectionProps = {
  pageItems: WorkListCardItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  queryState: WorksListQueryState;
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
  sortOptions: WorkSortOption[];
};

type WorksListGridProps = {
  items: WorkListCardItem[];
};

const WorksListGrid = memo(function WorksListGrid({ items }: WorksListGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <WorkListCard key={item.contentId} item={item} />
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
}: WorksListSectionProps) {
  const router = useRouter();
  const currentSort = parseWorkSortParam(queryState.sort);

  const updateQuery = useCallback(
    (patch: Partial<WorksListQueryState>, resetPage = false) => {
      const next = mergeQuery(queryState, patch, resetPage);
      const qs = buildWorksQueryString(next);
      router.push(qs ? `/works?${qs}` : "/works");
    },
    [queryState, router],
  );

  const activeConditions = [
    queryState.genre ? `ジャンル：${queryState.genre}` : null,
    queryState.maker ? `メーカー：${queryState.maker}` : null,
    queryState.price && queryState.price !== "all"
      ? `価格帯：${WORK_PRICE_FILTER_OPTIONS.find((o) => o.key === queryState.price)?.label ?? queryState.price}`
      : null,
    queryState.date && queryState.date !== "all"
      ? `発売日：${WORK_DATE_FILTER_OPTIONS.find((o) => o.key === queryState.date)?.label ?? queryState.date}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const clearFilters = useCallback(() => {
    updateQuery({ genre: undefined, maker: undefined, price: "all", date: "all" }, true);
  }, [updateQuery]);

  const handlePageChange = useCallback(
    (page: number) => {
      updateQuery({ page: String(page) });
    },
    [updateQuery],
  );

  return (
    <>
      <div className="mb-5 space-y-4">
        <WorksListControlGroup label="絞り込み">
          <div className="grid w-full gap-3 sm:grid-cols-2 md:flex md:flex-1 md:flex-wrap">
            <select
              value={queryState.genre ?? ""}
              onChange={(event) =>
                updateQuery({ genre: event.target.value || undefined }, true)
              }
              className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[140px]"
            >
              <option value="">ジャンル ▼</option>
              {genreOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={queryState.maker ?? ""}
              onChange={(event) =>
                updateQuery({ maker: event.target.value || undefined }, true)
              }
              className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[140px]"
            >
              <option value="">メーカー ▼</option>
              {makerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={queryState.price ?? "all"}
              onChange={(event) => updateQuery({ price: event.target.value }, true)}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[140px]"
            >
              <option value="all">価格帯 ▼</option>
              {WORK_PRICE_FILTER_OPTIONS.filter((o) => o.key !== "all").map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={queryState.date ?? "all"}
              onChange={(event) => updateQuery({ date: event.target.value }, true)}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[140px]"
            >
              <option value="all">発売日 ▼</option>
              {WORK_DATE_FILTER_OPTIONS.filter((o) => o.key !== "all").map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </WorksListControlGroup>

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

      {activeConditions.length > 0 ? (
        <div className="mb-5 rounded border border-border bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-foreground">絞り込み中：</p>
          {activeConditions.map((condition) => (
            <p key={condition} className="mt-1 text-muted">
              {condition}
            </p>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-accent hover:underline"
          >
            条件をクリア
          </button>
        </div>
      ) : null}

      <p className="mb-6 text-sm text-muted">
        {totalItems}件の作品が見つかりました。
        {totalPages > 1 ? `（${currentPage}/${totalPages}ページ目）` : null}
      </p>

      {pageItems.length > 0 ? (
        <>
          <WorksListGrid items={pageItems} />
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
