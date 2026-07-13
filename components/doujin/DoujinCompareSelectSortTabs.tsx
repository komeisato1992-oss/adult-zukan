"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import {
  DOUJIN_SIMILARITY_SORT_LABELS,
  DOUJIN_SIMILARITY_SORTS,
  type DoujinSimilaritySort,
} from "@/lib/doujin/compare/similarity";
import { buildDoujinCompareSelectHref } from "@/lib/doujin/compare/urls";

type DoujinCompareSelectSortTabsProps = {
  workId: string;
  currentSort: DoujinSimilaritySort;
};

export function DoujinCompareSelectSortTabs({
  workId,
  currentSort,
}: DoujinCompareSelectSortTabsProps) {
  const router = useRouter();

  function handleSelectChange(sort: DoujinSimilaritySort) {
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.sortChange, {
      content_id: workId,
      sort,
    });
    router.push(buildDoujinCompareSelectHref(workId, { sort, page: 1 }));
  }

  return (
    <div className="mt-4">
      <div className="hidden md:flex md:flex-wrap md:gap-2">
        {DOUJIN_SIMILARITY_SORTS.map((sort) => {
          const active = sort === currentSort;
          return (
            <Link
              key={sort}
              href={buildDoujinCompareSelectHref(workId, { sort, page: 1 })}
              onClick={() =>
                trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.sortChange, {
                  content_id: workId,
                  sort,
                })
              }
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-border text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {DOUJIN_SIMILARITY_SORT_LABELS[sort]}
            </Link>
          );
        })}
      </div>

      <div className="md:hidden">
        <label className="sr-only" htmlFor="doujin-compare-select-sort">
          並び替え
        </label>
        <select
          id="doujin-compare-select-sort"
          value={currentSort}
          onChange={(event) =>
            handleSelectChange(event.target.value as DoujinSimilaritySort)
          }
          className="mb-2 w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-foreground"
        >
          {DOUJIN_SIMILARITY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {DOUJIN_SIMILARITY_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {DOUJIN_SIMILARITY_SORTS.map((sort) => {
            const active = sort === currentSort;
            return (
              <Link
                key={sort}
                href={buildDoujinCompareSelectHref(workId, { sort, page: 1 })}
                onClick={() =>
                  trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.sortChange, {
                    content_id: workId,
                    sort,
                  })
                }
                className={`shrink-0 rounded-md border px-3 py-2 text-xs whitespace-nowrap ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border text-foreground"
                }`}
              >
                {DOUJIN_SIMILARITY_SORT_LABELS[sort]}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
