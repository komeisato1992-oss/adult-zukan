import Link from "next/link";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  getDmmItemActressNameList,
  getDmmItemPrice,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmWorkListCardProps = {
  item: DmmItem;
};

export function DmmWorkListCard({ item }: DmmWorkListCardProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article className="group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <Link href={`/works/${item.content_id}`} prefetch className="block max-w-full">
        <CatalogWorkImage src={imageUrl} alt={item.title} variant="landscape" />
        <div className="px-3 pt-3 pb-0">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
            {item.title}
          </h2>
        </div>
      </Link>
      <div className="px-3 pt-1">
        <CompactNameList names={actressNames} />
        {price && <p className="mt-1.5 text-sm font-bold text-accent">{price}</p>}
        <p className="mt-1 text-[11px] text-muted/90">{item.content_id}</p>
      </div>
      <div className="px-3 pb-3">
        <CompareToggleButton contentId={item.content_id} />
      </div>
    </article>
  );
}
