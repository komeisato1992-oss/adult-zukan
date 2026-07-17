import { Pagination } from "@/components/ui/Pagination";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import type { DmmItem } from "@/lib/dmm/types";
import {
  CATALOG_DETAIL_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type DmmCatalogWorksGridProps = {
  items: DmmItem[];
  className?: string;
  currentPage?: number;
  pageSize?: number;
  paginationBasePath?: string;
  paginationQuery?: Record<string, string | undefined>;
  /** false のとき一覧用の再フィルタを行わない（お気に入りなど） */
  applyDisplayableFilter?: boolean;
};

export function DmmCatalogWorksGrid({
  items,
  className = WORK_LIST_GRID_CLASSNAME,
  currentPage,
  pageSize = CATALOG_DETAIL_PAGE_SIZE,
  paginationBasePath,
  paginationQuery,
  applyDisplayableFilter = true,
}: DmmCatalogWorksGridProps) {
  const displayableItems = applyDisplayableFilter
    ? filterDisplayableItems(items)
    : items;
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
