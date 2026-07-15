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
    <article className="group flex h-full max-w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <div className="relative">
        <Link href={`/works/${item.contentId}`} className="block max-w-full">
          <CatalogWorkImage
            src={item.imageUrl}
            alt={item.title}
            variant="landscape"
            sizes="(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw"
          />
          {item.fanzaTvActive ? (
            <span className="absolute left-2 top-2 rounded bg-emerald-600/95 px-1.5 py-0.5 text-[10px] font-bold text-white">
              見放題
            </span>
          ) : null}
          <div className="px-3 pt-3 pb-0 max-[768px]:px-1.5 max-[768px]:pt-1.5">
            <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent max-[768px]:line-clamp-3 max-[768px]:text-[13px] max-[768px]:leading-[1.4]">
              {item.title}
            </h2>
          </div>
        </Link>
        <FavoriteCardButton contentId={item.contentId} title={item.title} />
      </div>
      <div className="flex flex-1 flex-col px-3 pt-1 max-[768px]:px-1.5 max-[768px]:pt-0.5">
        <CompactNameList
          names={item.actressNames}
          className="max-[768px]:text-[11px]"
        />
        {priceDisplayMode === "sale" && item.saleInfo ? (
          <WorkListSalePrice item={item} />
        ) : item.displayPrice ? (
          <p className="mt-1.5 text-sm font-bold text-price max-[768px]:mt-1 max-[768px]:text-[13px]">
            {item.displayPrice}
          </p>
        ) : null}
        <p className="mt-1 truncate text-[11px] text-muted/90 max-[768px]:hidden">
          {item.contentId}
        </p>
        <div className="mt-auto px-0 pb-3 pt-2 max-[768px]:pb-1.5 max-[768px]:pt-1.5">
          <WorkCardCtaRow
            contentId={item.contentId}
            title={item.title}
            fanzaUrl={item.fanzaUrl}
          />
        </div>
      </div>
    </article>
  );
}
