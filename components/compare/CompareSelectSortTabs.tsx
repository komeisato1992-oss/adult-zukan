"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import {
  SIMILARITY_SORT_LABELS,
  SIMILARITY_SORTS,
  type SimilaritySort,
} from "@/lib/compare/similarity";
import { buildCompareSelectHref } from "@/lib/compare/urls";

type CompareSelectSortTabsProps = {
  contentId: string;
  currentSort: SimilaritySort;
};

export function CompareSelectSortTabs({
  contentId,
  currentSort,
}: CompareSelectSortTabsProps) {
  const router = useRouter();

  function handleSelectChange(sort: SimilaritySort) {
    trackCompareEvent(COMPARE_GA_EVENTS.sortChange, {
      content_id: contentId,
      sort,
    });
    router.push(buildCompareSelectHref(contentId, { sort, page: 1 }));
  }

  return (
    <div className="mt-4">
      <div className="hidden md:flex md:flex-wrap md:gap-2">
        {SIMILARITY_SORTS.map((sort) => {
          const active = sort === currentSort;
          return (
            <Link
              key={sort}
              href={buildCompareSelectHref(contentId, { sort, page: 1 })}
              onClick={() =>
                trackCompareEvent(COMPARE_GA_EVENTS.sortChange, {
                  content_id: contentId,
                  sort,
                })
              }
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-border text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {SIMILARITY_SORT_LABELS[sort]}
            </Link>
          );
        })}
      </div>

      <div className="md:hidden">
        <label className="sr-only" htmlFor="compare-select-sort">
          並び替え
        </label>
        <select
          id="compare-select-sort"
          value={currentSort}
          onChange={(event) =>
            handleSelectChange(event.target.value as SimilaritySort)
          }
          className="mb-2 w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-foreground"
        >
          {SIMILARITY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SIMILARITY_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {SIMILARITY_SORTS.map((sort) => {
            const active = sort === currentSort;
            return (
              <Link
                key={sort}
                href={buildCompareSelectHref(contentId, { sort, page: 1 })}
                onClick={() =>
                  trackCompareEvent(COMPARE_GA_EVENTS.sortChange, {
                    content_id: contentId,
                    sort,
                  })
                }
                className={`shrink-0 rounded-md border px-3 py-2 text-xs whitespace-nowrap ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border text-foreground"
                }`}
              >
                {SIMILARITY_SORT_LABELS[sort]}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
