import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import type { DmmItem } from "@/lib/dmm/types";
import { filterItemsWithValidImage } from "@/lib/works";

type DmmCatalogWorksGridProps = {
  items: DmmItem[];
  className?: string;
};

export function DmmCatalogWorksGrid({
  items,
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
}: DmmCatalogWorksGridProps) {
  const visibleItems = filterItemsWithValidImage(items);

  if (visibleItems.length === 0) {
    return (
      <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
        該当する作品はありません。
      </p>
    );
  }

  return (
    <div className={className}>
      {visibleItems.map((item) => (
        <DmmWorkListCard key={item.content_id} item={item} />
      ))}
    </div>
  );
}
