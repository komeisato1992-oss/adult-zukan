"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import { WorksSortNav } from "@/components/works/WorksSortNav";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  CATALOG_DETAIL_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";
import {
  getWorksSortOptions,
  parseWorkSortParam,
  sortWorks,
} from "@/lib/works/sort";

type CatalogWorksListSectionProps = {
  items: DmmItem[];
  paginationBasePath: string;
  initialPage?: number;
  query?: Record<string, string | undefined>;
  className?: string;
};

function buildPaginationQuery(
  sort: ReturnType<typeof parseWorkSortParam>,
  query: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...query,
    sort: sort === "popular" ? undefined : sort,
  };
}

function CatalogWorksListSectionInner({
  items,
  paginationBasePath,
  initialPage = 1,
  query = {},
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
}: CatalogWorksListSectionProps) {
  const searchParams = useSearchParams();
  const currentSort = parseWorkSortParam(searchParams.get("sort"));
  const currentPage = parsePageParam(searchParams.get("page") ?? String(initialPage));

  const displayableItems = useMemo(
    () => filterDisplayableItems(items),
    [items],
  );
  const sortOptions = useMemo(
    () => getWorksSortOptions(displayableItems),
    [displayableItems],
  );
  const sortedItems = useMemo(
    () => sortWorks(displayableItems, currentSort),
    [displayableItems, currentSort],
  );
  const pagination = useMemo(
    () => paginateItems(sortedItems, currentPage, CATALOG_DETAIL_PAGE_SIZE),
    [sortedItems, currentPage],
  );
  const paginationQuery = buildPaginationQuery(currentSort, query);

  if (displayableItems.length === 0) {
    return (
      <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
        該当する作品はありません。
      </p>
    );
  }

  return (
    <>
      <WorksSortNav
        basePath={paginationBasePath}
        currentSort={currentSort}
        options={sortOptions}
        query={query}
      />

      <div className={className}>
        {pagination.items.map((item) => (
          <DmmWorkListCard key={item.content_id} item={item} />
        ))}
      </div>

      {pagination.totalPages > 1 ? (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          basePath={paginationBasePath}
          query={paginationQuery}
        />
      ) : null}
    </>
  );
}

export function CatalogWorksListSection(props: CatalogWorksListSectionProps) {
  return (
    <Suspense fallback={null}>
      <CatalogWorksListSectionInner {...props} />
    </Suspense>
  );
}
