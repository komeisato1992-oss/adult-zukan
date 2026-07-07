import { Pagination } from "@/components/ui/Pagination";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import type { DmmItem } from "@/lib/dmm/types";
import {
  CATALOG_DETAIL_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";
import { filterDisplayableItems } from "@/lib/dmm/filter";

type DmmCatalogWorksGridProps = {
  items: DmmItem[];
  className?: string;
  currentPage?: number;
  pageSize?: number;
  paginationBasePath?: string;
  paginationQuery?: Record<string, string | undefined>;
};

export function DmmCatalogWorksGrid({
  items,
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
  currentPage,
  pageSize = CATALOG_DETAIL_PAGE_SIZE,
  paginationBasePath,
  paginationQuery,
}: DmmCatalogWorksGridProps) {
  const displayableItems = filterDisplayableItems(items);
  const shouldPaginate = Boolean(paginationBasePath);
  const pagination = shouldPaginate
    ? paginateItems(displayableItems, parsePageParam(currentPage), pageSize)
    : null;
  const displayItems = pagination?.items ?? displayableItems;

  if (displayItems.length === 0) {
    return (
      <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
        該当する作品はありません。
      </p>
    );
  }

  return (
    <>
      <div className={className}>
        {displayItems.map((item) => (
          <DmmWorkListCard key={item.content_id} item={item} />
        ))}
      </div>
      {pagination && paginationBasePath && pagination.totalPages > 1 ? (
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
