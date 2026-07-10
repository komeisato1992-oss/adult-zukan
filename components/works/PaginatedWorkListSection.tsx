import { Pagination } from "@/components/ui/Pagination";
import { RankingWorkCard } from "@/components/ranking/RankingWorkCard";
import { WorkListCard } from "@/components/works/WorkListCard";
import { WorksSortNav } from "@/components/works/WorksSortNav";
import {
  DEFAULT_CATALOG_SORT_OPTIONS,
  type WorkSortKey,
  type WorkSortOption,
} from "@/lib/works/sort";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

type PaginatedWorkListSectionProps = {
  pageItems: WorkListCardItem[];
  currentPage: number;
  totalPages: number;
  basePath: string;
  currentSort?: WorkSortKey;
  sortOptions?: WorkSortOption[];
  query?: Record<string, string | undefined>;
  showSortNav?: boolean;
  showRank?: boolean;
  rankOffset?: number;
  emptyMessage?: string;
  className?: string;
};

function buildPaginationQuery(
  sort: WorkSortKey,
  query: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...query,
    sort: sort === "popular" ? undefined : sort,
  };
}

export function PaginatedWorkListSection({
  pageItems,
  currentPage,
  totalPages,
  basePath,
  currentSort = "popular",
  sortOptions = DEFAULT_CATALOG_SORT_OPTIONS,
  query = {},
  showSortNav = true,
  showRank = false,
  rankOffset = 0,
  emptyMessage = "該当する作品はありません。",
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
}: PaginatedWorkListSectionProps) {
  if (pageItems.length === 0) {
    return (
      <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  const paginationQuery = buildPaginationQuery(currentSort, query);

  return (
    <>
      {showSortNav ? (
        <WorksSortNav
          basePath={basePath}
          currentSort={currentSort}
          options={sortOptions}
          query={query}
        />
      ) : null}

      {showRank ? (
        <ol className={className}>
          {pageItems.map((item, index) => (
            <li key={item.contentId} className="relative">
              <span className="absolute -left-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
                {rankOffset + index + 1}
              </span>
              <RankingWorkCard item={item} />
            </li>
          ))}
        </ol>
      ) : (
        <div className={className}>
          {pageItems.map((item) => (
            <WorkListCard key={item.contentId} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={basePath}
          query={paginationQuery}
        />
      ) : null}
    </>
  );
}
