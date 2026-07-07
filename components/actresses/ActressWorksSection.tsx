"use client";

import { useCallback, useMemo, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import { getDmmItemMakerName } from "@/lib/dmm/display";
import type { ActressPageMaker } from "@/lib/dmm/actress-page";
import type { DmmItem } from "@/lib/dmm/types";
import {
  CATALOG_DETAIL_PAGE_SIZE,
  paginateItems,
} from "@/lib/pagination";

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
  const [selectedMaker, setSelectedMaker] = useState("all");
  const [clientPage, setClientPage] = useState(1);

  const isFiltered = selectedMaker !== "all";
  const paginationBasePath = `/actresses/${slug}`;

  const filteredItems = useMemo(() => {
    if (!isFiltered) {
      return items;
    }

    return items.filter(
      (item) => getDmmItemMakerName(item) === selectedMaker,
    );
  }, [items, isFiltered, selectedMaker]);

  const currentPage = isFiltered ? clientPage : initialPage;
  const pagination = useMemo(
    () => paginateItems(filteredItems, currentPage, CATALOG_DETAIL_PAGE_SIZE),
    [filteredItems, currentPage],
  );

  const handleMakerChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedMaker(event.target.value);
      setClientPage(1);
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
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="actress-maker-filter" className="font-medium text-foreground">
            メーカー：
          </label>
          <select
            id="actress-maker-filter"
            value={selectedMaker}
            onChange={handleMakerChange}
            className="min-w-[160px] rounded border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="all">すべて</option>
            {makers.map((maker) => (
              <option key={maker.name} value={maker.name}>
                {maker.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {pagination.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pagination.items.map((item) => (
              <DmmWorkListCard key={item.content_id} item={item} />
            ))}
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            basePath={paginationBasePath}
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
