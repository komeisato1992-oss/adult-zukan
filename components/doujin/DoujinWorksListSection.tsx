"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DoujinWorksFilters } from "@/components/doujin/DoujinWorksFilters";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import { Pagination } from "@/components/ui/Pagination";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  applyDoujinWorksFilterDraftToQuery,
  buildDoujinWorksQueryString,
  DOUJIN_WORK_SORT_OPTIONS,
  DOUJIN_WORKS_DEFAULT_SORT,
  getAppliedDoujinCircles,
  getAppliedDoujinGenres,
  type DoujinFilterOption,
  type DoujinWorkSortKey,
  type DoujinWorksFilterDraft,
  type DoujinWorksListQueryState,
} from "@/lib/doujin/list-filters";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinWorksListSectionProps = {
  works: DoujinWork[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  queryState: DoujinWorksListQueryState;
  sort: DoujinWorkSortKey;
  genreOptions: DoujinFilterOption[];
  circleOptions: DoujinFilterOption[];
  formatOptions: DoujinFilterOption[];
  yearOptions: string[];
};

function mergeQuery(
  current: DoujinWorksListQueryState,
  patch: Partial<DoujinWorksListQueryState>,
  resetPage = false,
): DoujinWorksListQueryState {
  return {
    ...current,
    ...patch,
    page: resetPage ? "1" : (patch.page ?? current.page ?? "1"),
  };
}

export function DoujinWorksListSection({
  works,
  totalItems,
  totalPages,
  currentPage,
  queryState,
  sort,
  genreOptions,
  circleOptions,
  formatOptions,
  yearOptions,
}: DoujinWorksListSectionProps) {
  const router = useRouter();

  const navigate = useCallback(
    (next: DoujinWorksListQueryState) => {
      const qs = buildDoujinWorksQueryString(next);
      router.push(qs ? `/doujin/works?${qs}` : "/doujin/works");
    },
    [router],
  );

  const updateQuery = useCallback(
    (patch: Partial<DoujinWorksListQueryState>, resetPage = false) => {
      navigate(mergeQuery(queryState, patch, resetPage));
    },
    [navigate, queryState],
  );

  const applyFilters = useCallback(
    (draft: DoujinWorksFilterDraft, resetPage = true) => {
      const next = applyDoujinWorksFilterDraftToQuery(
        mergeQuery(queryState, {}, resetPage),
        draft,
      );
      navigate(next);
    },
    [navigate, queryState],
  );

  const genres = getAppliedDoujinGenres(queryState);
  const circles = getAppliedDoujinCircles(queryState);

  const paginationQuery: Record<string, string | undefined> = {
    genre: genres.length === 1 ? genres[0] : undefined,
    genres: genres.length > 1 ? genres.join(",") : undefined,
    circle: circles.length === 1 ? circles[0] : undefined,
    circles: circles.length > 1 ? circles.join(",") : undefined,
    format: queryState.format,
    price: queryState.price,
    release: queryState.release,
    year: queryState.year,
    sort: sort === DOUJIN_WORKS_DEFAULT_SORT ? undefined : sort,
  };

  return (
    <>
      <div className="mb-5 space-y-4">
        <DoujinWorksFilters
          genreOptions={genreOptions}
          circleOptions={circleOptions}
          formatOptions={formatOptions}
          yearOptions={yearOptions}
          appliedQuery={queryState}
          onApply={applyFilters}
        />

        <WorksListControlGroup label="並び替え">
          <select
            id="doujin-works-sort"
            value={sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value }, true)
            }
            className="h-10 rounded border border-border bg-white px-3 text-sm text-foreground md:min-w-[160px]"
          >
            {DOUJIN_WORK_SORT_OPTIONS.map((option) => (
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

      {totalItems === 0 ? (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          条件に一致する作品が見つかりませんでした。条件を変更するか、絞り込みを解除してください。
        </p>
      ) : (
        <>
          <DoujinWorksGrid works={works} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/doujin/works"
            query={paginationQuery}
          />
        </>
      )}
    </>
  );
}
