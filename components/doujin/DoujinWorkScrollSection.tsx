import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
import { DOUJIN_WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinWorkScrollSectionProps = {
  title: string;
  items: DoujinWork[];
  href?: string;
  id?: string;
};

export function DoujinWorkScrollSection({
  title,
  items,
  href,
  id,
}: DoujinWorkScrollSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title={title} href={href} id={id} />
      {/* モバイル(≤768px): 2/3列グリッド / PC(≥769px): 既存の横スクロール */}
      <div className={`min-[769px]:hidden ${DOUJIN_WORK_LIST_GRID_CLASSNAME}`}>
        {items.map((work) => (
          <DoujinWorkCard key={work.id} work={work} />
        ))}
      </div>
      <div className="scrollbar-hide -mx-4 hidden gap-4 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory min-[769px]:-mx-0 min-[769px]:flex min-[769px]:gap-5 min-[769px]:px-0">
        {items.map((work) => (
          <div
            key={work.id}
            className="w-[220px] shrink-0 snap-start sm:w-[260px] lg:w-[280px]"
          >
            <DoujinWorkCard work={work} />
          </div>
        ))}
      </div>
    </section>
  );
}
