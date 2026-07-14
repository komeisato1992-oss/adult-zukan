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
import { WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type CatalogWorksListSectionProps = {
  items: DmmItem[];
  paginationBasePath: string;
  initialPage?: number;
  query?: Record<string, string | undefined>;
  className?: string;
  /** サーバー側でページ分割済みのときに指定 */
  totalItems?: number;
  totalPages?: number;
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
  className = WORK_LIST_GRID_CLASSNAME,
  totalItems: serverTotalItems,
  totalPages: serverTotalPages,
}: CatalogWorksListSectionProps) {
  const searchParams = useSearchParams();
  const currentSort = parseWorkSortParam(searchParams.get("sort"));
  const currentPage = parsePageParam(searchParams.get("page") ?? String(initialPage));
  const serverPaginated =
    serverTotalItems !== undefined && serverTotalPages !== undefined;

  const displayableItems = useMemo(
    () => (serverPaginated ? items : filterDisplayableItems(items)),
    [items, serverPaginated],
  );
  const sortOptions = useMemo(
    () => getWorksSortOptions(displayableItems),
    [displayableItems],
  );
  const sortedItems = useMemo(
    () => (serverPaginated ? displayableItems : sortWorks(displayableItems, currentSort)),
    [displayableItems, currentSort, serverPaginated],
  );
  const pagination = useMemo(() => {
    if (serverPaginated) {
      return {
        items: sortedItems,
        currentPage,
        totalPages: serverTotalPages,
        totalItems: serverTotalItems,
      };
    }

    return paginateItems(sortedItems, currentPage, CATALOG_DETAIL_PAGE_SIZE);
  }, [sortedItems, currentPage, serverPaginated, serverTotalItems, serverTotalPages]);
  const paginationQuery = useMemo(
    () => buildPaginationQuery(currentSort, query),
    [currentSort, query],
  );

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
