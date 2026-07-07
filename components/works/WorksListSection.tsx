"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import {
  buildWorksQueryString,
  filterWorksByQuery,
  getWorkFilterOptions,
  WORK_DATE_FILTER_OPTIONS,
  WORK_PRICE_FILTER_OPTIONS,
  type WorksListQueryState,
} from "@/lib/works/list-filters";
import { parsePageParam, paginateItems, WORKS_LIST_PAGE_SIZE } from "@/lib/pagination";
import { getWorksSortOptions, parseWorkSortParam, sortWorks } from "@/lib/works/sort";
import type { DmmItem } from "@/lib/dmm/types";

type WorksListSectionProps = {
  items: DmmItem[];
};

function parseQueryState(search: string): WorksListQueryState {
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") ?? undefined,
    sale: params.get("sale") ?? undefined,
    filter: params.get("filter") ?? undefined,
    sort: params.get("sort") ?? undefined,
    genre: params.get("genre") ?? undefined,
    maker: params.get("maker") ?? undefined,
    price: params.get("price") ?? "all",
    date: params.get("date") ?? "all",
    page: params.get("page") ?? "1",
  };
}

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

export function WorksListSection({ items }: WorksListSectionProps) {
  const searchParams = useSearchParams();
  const [queryState, setQueryState] = useState<WorksListQueryState>(() =>
    parseQueryState(searchParams.toString()),
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setQueryState(parseQueryState(searchParams.toString()));
  }, [searchParams]);

  useEffect(() => {
    const onPopState = () => {
      setQueryState(parseQueryState(window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateQuery = useCallback(
    (patch: Partial<WorksListQueryState>, resetPage = false) => {
      setQueryState((current) => {
        const next = mergeQuery(current, patch, resetPage);
        const qs = buildWorksQueryString(next);
        const url = qs ? `/works?${qs}` : "/works";
        window.history.replaceState(null, "", url);
        return next;
      });
    },
    [],
  );

  const { genreOptions, makerOptions } = useMemo(
    () => getWorkFilterOptions(items),
    [items],
  );
  const sortOptions = useMemo(() => getWorksSortOptions(items), [items]);
  const currentSort = parseWorkSortParam(queryState.sort);

  const filtered = useMemo(
    () => filterWorksByQuery(items, queryState),
    [items, queryState],
  );
  const sorted = useMemo(() => sortWorks(filtered, currentSort), [filtered, currentSort]);
  const currentPage = parsePageParam(queryState.page);
  const pagination = useMemo(
    () => paginateItems(sorted, currentPage, WORKS_LIST_PAGE_SIZE),
    [sorted, currentPage],
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
  ].filter((v): v is string => Boolean(v));

  const clearFilters = useCallback(() => {
    updateQuery({ genre: undefined, maker: undefined, price: "all", date: "all" }, true);
  }, [updateQuery]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="rounded border border-border bg-white px-3 py-2 text-sm text-foreground"
        >
          絞り込み
        </button>
      </div>

      <div className={`${mobileOpen ? "block" : "hidden"} mb-5 space-y-3 md:block`}>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={queryState.genre ?? ""}
            onChange={(event) =>
              updateQuery({ genre: event.target.value || undefined }, true)
            }
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
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
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
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
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
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
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
          >
            <option value="all">発売日 ▼</option>
            {WORK_DATE_FILTER_OPTIONS.filter((o) => o.key !== "all").map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted" htmlFor="works-sort">
            並び替え
          </label>
          <select
            id="works-sort"
            value={currentSort}
            onChange={(event) => updateQuery({ sort: event.target.value }, true)}
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
        {pagination.totalItems}件の作品が見つかりました。
        {pagination.totalPages > 1
          ? `（${pagination.currentPage}/${pagination.totalPages}ページ目）`
          : null}
      </p>

      {pagination.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pagination.items.map((item) => (
              <DmmWorkListCard key={item.content_id} item={item} />
            ))}
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            basePath="/works"
            onPageChange={(page) => updateQuery({ page: String(page) })}
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
