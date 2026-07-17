import { MoreSeeScrollCard } from "@/components/home/MoreSeeScrollCard";
import { DmmWorkCard } from "@/components/works/DmmWorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { DmmItem } from "@/lib/dmm/types";
import { HOME_SECTION_DISPLAY_LIMIT } from "@/lib/pagination";
import { filterItemsWithValidImage } from "@/lib/works";

type DmmWorkScrollSectionProps = {
  title: string;
  items: DmmItem[];
  href?: string;
  id?: string;
  /** 「もっと見る」カード用の短いセクション名（絵文字なし） */
  moreLabel?: string;
};

function stripSectionEmoji(title: string): string {
  return title.replace(/^[^0-9A-Za-zぁ-んァ-ヶー一-龥]+/, "").trim() || title;
}

export function DmmWorkScrollSection({
  title,
  items,
  href,
  id,
  moreLabel,
}: DmmWorkScrollSectionProps) {
  const visibleItems = filterItemsWithValidImage(items).slice(
    0,
    HOME_SECTION_DISPLAY_LIMIT,
  );

  if (visibleItems.length === 0) return null;

  const sectionLabel = moreLabel ?? stripSectionEmoji(title);

  return (
    <section aria-labelledby={id} className="mb-7 min-[769px]:mb-12">
      <SectionHeader title={title} href={href} id={id} />
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-1 snap-x snap-mandatory min-[769px]:-mx-0 min-[769px]:gap-5 min-[769px]:px-0 min-[769px]:pb-3">
        {visibleItems.map((item) => (
          <div
            key={item.content_id}
            className="w-[112px] shrink-0 snap-start min-[769px]:w-[204px] lg:w-[216px]"
          >
            <DmmWorkCard item={item} size="large" compact />
          </div>
        ))}
        {href ? (
          <MoreSeeScrollCard
            href={href}
            sectionLabel={sectionLabel}
            className="w-[100px] min-h-[168px] min-[769px]:w-[180px] min-[769px]:min-h-[280px] lg:w-[192px]"
          />
        ) : null}
      </div>
    </section>
  );
}
