"use client";

import { useCallback, useMemo, useState, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import { WorksSortNav } from "@/components/works/WorksSortNav";
import { getDmmItemMakerName } from "@/lib/dmm/display";
import type { ActressPageMaker } from "@/lib/dmm/actress-page";
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

type ActressWorksSectionProps = {
  items: DmmItem[];
  makers: ActressPageMaker[];
  slug: string;
  initialPage: number;
};

export function ActressWorksSection({
  items,
  makers,
  slug,
  initialPage,
}: ActressWorksSectionProps) {
  const searchParams = useSearchParams();
  const [selectedMaker, setSelectedMaker] = useState("all");
  const [clientPage, setClientPage] = useState(1);

  const currentSort = parseWorkSortParam(searchParams.get("sort"));
  const isFiltered = selectedMaker !== "all";
  const paginationBasePath = `/actresses/${slug}`;
  const urlPage = parsePageParam(searchParams.get("page") ?? String(initialPage));

  const filteredItems = useMemo(() => {
    if (!isFiltered) {
      return items;
    }

    return items.filter(
      (item) => getDmmItemMakerName(item) === selectedMaker,
    );
  }, [items, isFiltered, selectedMaker]);

  const sortOptions = useMemo(
    () => getWorksSortOptions(filteredItems),
    [filteredItems],
  );
  const sortedItems = useMemo(
    () => sortWorks(filteredItems, currentSort),
    [filteredItems, currentSort],
  );

  const currentPage = isFiltered ? clientPage : urlPage;
  const pagination = useMemo(
    () => paginateItems(sortedItems, currentPage, CATALOG_DETAIL_PAGE_SIZE),
    [sortedItems, currentPage],
  );
  const paginationQuery = {
    sort: currentSort === "popular" ? undefined : currentSort,
  };

  const handleMakerChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      startTransition(() => {
        setSelectedMaker(value);
        setClientPage(1);
      });
    },
    [],
  );

  const handlePageChange = useCallback((page: number) => {
    setClientPage(page);
  }, []);

  return (
    <section aria-labelledby="actress-works" className="mb-10">
      <SectionHeader title="作品一覧" id="actress-works" />

      {makers.length > 0 ? (
        <WorksListControlGroup label="絞り込み" className="mb-4">
          <select
            id="actress-maker-filter"
            value={selectedMaker}
            onChange={handleMakerChange}
            className="h-10 min-w-[160px] rounded border border-border bg-white px-3 text-sm text-foreground"
          >
            <option value="all">メーカー ▼</option>
            {makers.map((maker) => (
              <option key={maker.name} value={maker.name}>
                {maker.name}
              </option>
            ))}
          </select>
        </WorksListControlGroup>
      ) : null}

      <WorksSortNav
        basePath={paginationBasePath}
        currentSort={currentSort}
        options={sortOptions}
      />

      {pagination.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 min-[769px]:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pagination.items.map((item) => (
              <DmmWorkListCard key={item.content_id} item={item} />
            ))}
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            basePath={paginationBasePath}
            query={paginationQuery}
            onPageChange={isFiltered ? handlePageChange : undefined}
          />
        </>
      ) : (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          該当する作品はありません。
        </p>
      )}
    </section>
  );
}
