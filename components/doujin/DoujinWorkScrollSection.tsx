import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
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
      <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory sm:-mx-0 sm:gap-5 sm:px-0">
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
