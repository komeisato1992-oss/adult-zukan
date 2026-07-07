"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActressGridCard } from "@/components/actresses/ActressGridCard";
import { Pagination } from "@/components/ui/Pagination";
import {
  ACTRESS_LIMIT_OPTIONS,
  ACTRESS_SORT_OPTIONS,
  buildActressListUrl,
  parseActressLimitParam,
  parseActressSortParam,
  sortActresses,
  type ActressLimit,
  type ActressListItem,
  type ActressSortKey,
} from "@/lib/actresses/sort";
import { paginateItems, parsePageParam } from "@/lib/pagination";

type ActressListParams = {
  sort: ActressSortKey;
  limit: ActressLimit;
  page: number;
  q: string;
};

const BASE_PATH = "/actresses";

function parseActressListParams(search: string): ActressListParams {
  const searchParams = new URLSearchParams(search);

  return {
    sort: parseActressSortParam(searchParams.get("sort")),
    limit: parseActressLimitParam(searchParams.get("limit")),
    page: parsePageParam(searchParams.get("page") ?? undefined),
    q: searchParams.get("q")?.trim() ?? "",
  };
}

function replaceActressListUrl(params: ActressListParams) {
  const url = buildActressListUrl(BASE_PATH, params);
  window.history.replaceState(null, "", url);
}

type ActressListSectionProps = {
  actresses: ActressListItem[];
};

export function ActressListSection({ actresses }: ActressListSectionProps) {
  const searchParams = useSearchParams();
  const [params, setParams] = useState<ActressListParams>(() =>
    parseActressListParams(searchParams.toString()),
  );
  const [searchInput, setSearchInput] = useState(
    () => parseActressListParams(searchParams.toString()).q,
  );

  useEffect(() => {
    const handlePopState = () => {
      const nextParams = parseActressListParams(window.location.search);
      setParams(nextParams);
      setSearchInput(nextParams.q);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const updateParams = useCallback(
    (patch: Partial<ActressListParams>, resetPage = false) => {
      setParams((current) => {
        const next: ActressListParams = {
          ...current,
          ...patch,
          page: resetPage ? 1 : (patch.page ?? current.page),
        };
        replaceActressListUrl(next);
        return next;
      });
    },
    [],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      updateParams({ q: searchInput.trim() }, true);
    },
    [searchInput, updateParams],
  );

  const handleSortChange = useCallback(
    (sort: ActressSortKey) => {
      updateParams({ sort }, true);
    },
    [updateParams],
  );

  const handleLimitChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      updateParams(
        { limit: parseActressLimitParam(event.target.value) },
        true,
      );
    },
    [updateParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams],
  );

  const visibleActresses = useMemo(() => {
    const keyword = params.q.trim().toLowerCase();
    const filtered = keyword
      ? actresses.filter((actress) =>
          actress.name.toLowerCase().includes(keyword),
        )
      : actresses;

    return sortActresses(filtered, params.sort);
  }, [actresses, params.q, params.sort]);

  const pagination = useMemo(
    () => paginateItems(visibleActresses, params.page, params.limit),
    [visibleActresses, params.page, params.limit],
  );

  return (
    <section aria-labelledby="actress-list">
      <h2 id="actress-list" className="sr-only">
        女優一覧
      </h2>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="flex flex-1 items-center gap-2"
        >
          <label htmlFor="actress-search" className="sr-only">
            女優名で検索
          </label>
          <input
            id="actress-search"
            type="search"
            name="q"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="女優名で検索"
            autoComplete="off"
            className="h-10 w-full rounded border border-border bg-white px-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            検索
          </button>
        </form>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <nav aria-label="並び替え" className="flex flex-wrap gap-2">
            {ACTRESS_SORT_OPTIONS.map(({ key, label }) => {
              const isActive = key === params.sort;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSortChange(key)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-white text-foreground hover:border-accent hover:text-accent"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="actress-limit" className="shrink-0 text-muted">
              表示件数
            </label>
            <select
              id="actress-limit"
              value={params.limit}
              onChange={handleLimitChange}
              className="h-10 min-w-[88px] rounded border border-border bg-white px-3 text-sm text-foreground"
            >
              {ACTRESS_LIMIT_OPTIONS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}件
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {pagination.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pagination.items.map((actress) => (
              <ActressGridCard key={actress.slug} actress={actress} />
            ))}
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            basePath={BASE_PATH}
            onPageChange={handlePageChange}
          />
        </>
      ) : (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          該当する女優は見つかりませんでした。
        </p>
      )}
    </section>
  );
}
