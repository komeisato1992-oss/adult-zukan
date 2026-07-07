import { DmmRelatedWorkCard } from "@/components/works/DmmRelatedWorkCard";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type DmmRelatedWorksProps = {
  items: DmmItem[];
  title?: string;
  sectionId?: string;
};

export function DmmRelatedWorks({
  items,
  title = "関連作品",
  sectionId = "related-works",
}: DmmRelatedWorksProps) {
  const visibleItems = filterItemsWithValidImage(items);

  if (visibleItems.length === 0) {
    return null;
  }

  const headingId = `${sectionId}-title`;

  return (
    <section aria-labelledby={headingId} className="mt-12">
      <h2
        id={headingId}
        className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
      >
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {visibleItems.map((item) => (
          <DmmRelatedWorkCard key={item.content_id} item={item} />
        ))}
      </div>
    </section>
  );
}
