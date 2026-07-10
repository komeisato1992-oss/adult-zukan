import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import { WorkListSalePrice } from "@/components/works/WorkListSalePrice";
import { CompactNameList } from "@/components/ui/CompactNameList";
import type {
  WorkListCardItem,
  WorkListCardPriceDisplayMode,
} from "@/lib/works/work-list-card-item.types";

type WorkListCardProps = {
  item: WorkListCardItem;
  priceDisplayMode?: WorkListCardPriceDisplayMode;
};

export function WorkListCard({
  item,
  priceDisplayMode = "default",
}: WorkListCardProps) {
  return (
    <article className="group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <div className="relative">
        <Link href={`/works/${item.contentId}`} className="block max-w-full">
          <CatalogWorkImage src={item.imageUrl} alt={item.title} variant="landscape" />
          <div className="px-3 pt-3 pb-0">
            <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
              {item.title}
            </h2>
          </div>
        </Link>
        <FavoriteCardButton contentId={item.contentId} title={item.title} />
      </div>
      <div className="px-3 pt-1">
        <CompactNameList names={item.actressNames} />
        {priceDisplayMode === "sale" && item.saleInfo ? (
          <WorkListSalePrice item={item} />
        ) : item.displayPrice ? (
          <p className="mt-1.5 text-sm font-bold text-accent">{item.displayPrice}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted/90">{item.contentId}</p>
      </div>
      <div className="px-3 pb-3">
        <WorkCardCtaRow contentId={item.contentId} fanzaUrl={item.fanzaUrl} />
      </div>
    </article>
  );
}
