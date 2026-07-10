"use client";

import { FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ActressGridCard } from "@/components/actresses/ActressGridCard";
import { Pagination } from "@/components/ui/Pagination";
import type { ActressListPageData } from "@/lib/actresses/sort";
import {
  ACTRESS_LIMIT_OPTIONS,
  buildActressListUrl,
  type ActressLimit,
  type ActressSortKey,
} from "@/lib/actresses/sort";

const BASE_PATH = "/actresses";

type ActressListSectionProps = {
  listData: ActressListPageData;
};

export function ActressListSection({ listData }: ActressListSectionProps) {
  const router = useRouter();
  const {
    pageItems,
    totalItems,
    totalPages,
    currentPage,
    sort,
    limit,
    q,
  } = listData;

  const navigate = useCallback(
    (
      patch: {
        sort?: ActressSortKey;
        limit?: ActressLimit;
        currentPage?: number;
        q?: string;
      },
      resetPage = false,
    ) => {
      const url = buildActressListUrl(BASE_PATH, {
        sort: patch.sort ?? sort,
        limit: patch.limit ?? limit,
        page: resetPage ? 1 : (patch.currentPage ?? currentPage),
        q: patch.q ?? q,
      });
      router.push(url);
    },
    [router, sort, limit, currentPage, q],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const nextQuery = String(formData.get("q") ?? "").trim();
      navigate({ q: nextQuery }, true);
    },
    [navigate],
  );

  const handleLimitChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextLimit = Number(event.target.value);
      navigate(
        {
          limit:
            nextLimit === 50 || nextLimit === 100
              ? nextLimit
              : 20,
        },
        true,
      );
    },
    [navigate],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      navigate({ currentPage: page });
    },
    [navigate],
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
            defaultValue={q}
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

        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="actress-limit" className="shrink-0 text-muted">
            表示件数
          </label>
          <select
            id="actress-limit"
            value={limit}
            onChange={handleLimitChange}
            className="h-10 min-w-[88px] rounded border border-border bg-white px-3 text-sm text-foreground"
          >
            {ACTRESS_LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}件
              </option>
            ))}
          </select>
        </div>
      </div>

      {q ? (
        <p className="mb-4 text-sm text-muted">
          「{q}」の検索結果：{totalItems}名
          {totalPages > 1 ? `（${currentPage}/${totalPages}ページ目）` : null}
        </p>
      ) : null}

      {pageItems.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((actress) => (
              <ActressGridCard key={actress.slug} actress={actress} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={BASE_PATH}
            query={{
              sort: sort === "popular" ? undefined : sort,
              limit: limit === 20 ? undefined : String(limit),
              q: q || undefined,
            }}
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
