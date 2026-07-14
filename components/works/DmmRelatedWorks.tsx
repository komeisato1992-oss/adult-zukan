import Link from "next/link";
import { DmmRelatedWorkCard } from "@/components/works/DmmRelatedWorkCard";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type DmmRelatedWorksProps = {
  items: DmmItem[];
  title?: string;
  sectionId?: string;
  moreHref?: string;
  moreLabel?: string;
};

export function DmmRelatedWorks({
  items,
  title = "関連作品",
  sectionId = "related-works",
  moreHref,
  moreLabel = "もっと見る",
}: DmmRelatedWorksProps) {
  const visibleItems = filterItemsWithValidImage(items);

  if (visibleItems.length === 0) {
    return null;
  }

  const headingId = `${sectionId}-title`;
  const useScroll = visibleItems.length >= 3;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-10 max-[768px]:mt-8 max-[768px]:pb-1"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="min-w-0 border-l-4 border-accent pl-3 text-lg font-bold text-foreground max-[768px]:text-[17px]"
        >
          {title}
        </h2>
        {moreHref ? (
          <Link
            href={moreHref}
            className="shrink-0 text-[13px] font-medium text-muted hover:text-accent"
          >
            {moreLabel} →
          </Link>
        ) : null}
      </div>

      {useScroll ? (
        <div className="relative">
          <div className="scrollbar-hide -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 snap-x snap-mandatory min-[769px]:-mx-0 min-[769px]:gap-3 min-[769px]:px-0">
            {visibleItems.map((item) => (
              <div
                key={item.content_id}
                className="w-[42vw] max-w-[148px] shrink-0 snap-start min-[769px]:w-[168px] min-[769px]:max-w-none lg:w-[180px]"
              >
                <DmmRelatedWorkCard item={item} />
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5 min-[769px]:gap-3">
          {visibleItems.map((item) => (
            <div
              key={item.content_id}
              className="w-[calc(50%-0.325rem)] max-w-[180px] min-[769px]:w-[168px] lg:w-[180px]"
            >
              <DmmRelatedWorkCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
