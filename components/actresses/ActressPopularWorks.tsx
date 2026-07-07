import { DmmWorkCard } from "@/components/works/DmmWorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getDmmReleaseDate } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type ActressPopularWorksProps = {
  items: DmmItem[];
};

export function ActressPopularWorks({ items }: ActressPopularWorksProps) {
  const visibleItems = filterItemsWithValidImage(items).slice(0, 6);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="actress-popular" className="mb-10">
      <SectionHeader title="人気作品" id="actress-popular" />
      <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory sm:-mx-0 sm:px-0">
        {visibleItems.map((item) => (
          <div
            key={item.content_id}
            className="w-[168px] shrink-0 snap-start sm:w-[204px] lg:w-[216px]"
          >
            <DmmWorkCard
              item={item}
              size="large"
              releaseDate={getDmmReleaseDate(item)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
