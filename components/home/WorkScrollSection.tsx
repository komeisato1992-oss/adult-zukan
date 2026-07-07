import { WorkCard } from "@/components/ui/WorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Work } from "@/data/types";

type WorkScrollSectionProps = {
  title: string;
  works: Work[];
  href?: string;
  id?: string;
};

export function WorkScrollSection({
  title,
  works,
  href,
  id,
}: WorkScrollSectionProps) {
  if (works.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title={title} href={href} id={id} />
      <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory sm:-mx-0 sm:px-0">
        {works.map((work) => (
          <div
            key={work.slug}
            className="w-[168px] shrink-0 snap-start sm:w-[204px] lg:w-[216px]"
          >
            <WorkCard work={work} size="large" />
          </div>
        ))}
      </div>
    </section>
  );
}
