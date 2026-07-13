import Link from "next/link";
import { memo } from "react";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  getDmmItemActressNameList,
  getDmmItemPrice,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmWorkListCardProps = {
  item: DmmItem;
};

function DmmWorkListCardInner({ item }: DmmWorkListCardProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);
  const fanzaUrl = getDmmFanzaUrl(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article className="group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <div className="relative">
        <Link href={`/works/${item.content_id}`} className="block max-w-full">
          <CatalogWorkImage src={imageUrl} alt={item.title} variant="landscape" />
          <div className="px-3 pt-3 pb-0">
            <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
              {item.title}
            </h2>
          </div>
        </Link>
        <FavoriteCardButton contentId={item.content_id} title={item.title} />
      </div>
      <div className="px-3 pt-1">
        <CompactNameList names={actressNames} />
        {price && <p className="mt-1.5 text-sm font-bold text-price">{price}</p>}
        <p className="mt-1 text-[11px] text-muted/90">{item.content_id}</p>
      </div>
      <div className="px-3 pb-3">
        <WorkCardCtaRow contentId={item.content_id} fanzaUrl={fanzaUrl ?? ""} />
      </div>
    </article>
  );
}

export const DmmWorkListCard = memo(
  DmmWorkListCardInner,
  (prev, next) => prev.item.content_id === next.item.content_id,
);
