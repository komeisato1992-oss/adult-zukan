import { DmmWorkCard } from "@/components/works/DmmWorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type DmmWorkScrollSectionProps = {
  title: string;
  items: DmmItem[];
  href?: string;
  id?: string;
};

export function DmmWorkScrollSection({
  title,
  items,
  href,
  id,
}: DmmWorkScrollSectionProps) {
  const visibleItems = filterItemsWithValidImage(items);

  if (visibleItems.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title={title} href={href} id={id} />
      <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory sm:-mx-0 sm:px-0">
        {visibleItems.map((item) => (
          <div
            key={item.content_id}
            className="w-[168px] shrink-0 snap-start sm:w-[204px] lg:w-[216px]"
          >
            <DmmWorkCard item={item} size="large" />
          </div>
        ))}
      </div>
    </section>
  );
}
