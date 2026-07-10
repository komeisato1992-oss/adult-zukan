import { Suspense } from "react";
import { ActressMakerFilter } from "@/components/actresses/ActressMakerFilter";
import { PaginatedWorkListSection } from "@/components/works/PaginatedWorkListSection";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { ActressPageMaker } from "@/lib/dmm/actress-page";
import type { PaginatedWorkCardList } from "@/lib/works/paginated-work-list";
import type { WorkSortKey } from "@/lib/works/sort";

type ActressPaginatedWorksProps = {
  slug: string;
  makers: ActressPageMaker[];
  selectedMaker?: string;
  currentSort: WorkSortKey;
  list: PaginatedWorkCardList;
};

export function ActressPaginatedWorks({
  slug,
  makers,
  selectedMaker,
  currentSort,
  list,
}: ActressPaginatedWorksProps) {
  const basePath = `/actresses/${slug}`;
  const query = selectedMaker ? { maker: selectedMaker } : {};

  return (
    <section aria-labelledby="actress-works" className="mb-10">
      <SectionHeader title="作品一覧" id="actress-works" />

      {makers.length > 0 ? (
        <Suspense fallback={null}>
          <ActressMakerFilter
            makers={makers}
            basePath={basePath}
            selectedMaker={selectedMaker}
          />
        </Suspense>
      ) : null}

      <PaginatedWorkListSection
        pageItems={list.pageItems}
        currentPage={list.currentPage}
        totalPages={list.totalPages}
        basePath={basePath}
        currentSort={currentSort}
        query={query}
      />
    </section>
  );
}
