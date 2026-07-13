import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  getDmmItemActressNameList,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { hasValidImage } from "@/lib/works";

type DmmWorkCardProps = {
  item: DmmItem;
  className?: string;
  size?: "default" | "large";
  releaseDate?: string;
};

function getDmmCardPrice(item: DmmItem) {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  const isOnSale = listPrice > 0 && price > 0 && price < listPrice;

  return {
    current: item.prices?.price
      ? formatDmmPriceString(item.prices.price)
      : undefined,
    original:
      isOnSale && item.prices?.list_price
        ? formatDmmPriceString(item.prices.list_price)
        : undefined,
    isOnSale,
  };
}

export function DmmWorkCard({
  item,
  className = "",
  size = "default",
  releaseDate,
}: DmmWorkCardProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const { current, original, isOnSale } = getDmmCardPrice(item);

  const paddingX =
    size === "large"
      ? "px-4 max-[768px]:px-2.5"
      : "px-3 max-[768px]:px-2";
  const titleSize =
    size === "large"
      ? "text-base max-[768px]:text-[15px]"
      : "text-sm max-[768px]:text-[15px]";
  const priceSize =
    size === "large"
      ? "text-base max-[768px]:text-[15px]"
      : "text-sm max-[768px]:text-[15px]";

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article
      className={`group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <div className="relative">
        <Link href={`/works/${item.content_id}`} prefetch className="block max-w-full">
          <div className="relative">
            <CatalogWorkImage src={imageUrl} alt={item.title} variant="portrait" />
            {isOnSale && (
              <span className="absolute right-2.5 top-2.5 z-10 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                SALE
              </span>
            )}
          </div>
          <div className={`${paddingX} pt-3 pb-0 max-[768px]:pt-2`}>
            <h3
              className={`line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-accent max-[768px]:line-clamp-3 ${titleSize}`}
            >
              {item.title}
            </h3>
            {releaseDate ? (
              <p className="mt-1.5 text-xs text-muted">{releaseDate}</p>
            ) : null}
          </div>
        </Link>
        <FavoriteCardButton contentId={item.content_id} title={item.title} />
      </div>
      <div className={`${paddingX} pt-1.5 max-[768px]:pt-1`}>
        <CompactNameList
          names={actressNames}
          className="max-[768px]:text-[13px]"
        />
        {current && (
          <div className="mt-2.5 flex items-baseline gap-2 max-[768px]:mt-1.5">
            <span className={`font-bold text-price ${priceSize}`}>{current}</span>
            {original && (
              <span className="text-xs text-muted line-through">{original}</span>
            )}
          </div>
        )}
        <p className="mt-1 truncate text-[11px] text-muted/90">{item.content_id}</p>
      </div>
      <div className={`${paddingX} pb-3 max-[768px]:pb-2`}>
        <WorkCardCtaRow
          contentId={item.content_id}
          title={item.title}
          fanzaUrl={getDmmFanzaUrl(item)}
        />
      </div>
    </article>
  );
}
