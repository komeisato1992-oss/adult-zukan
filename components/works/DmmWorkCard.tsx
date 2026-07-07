import Link from "next/link";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import {
  getDmmItemMakerName,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
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
  const makerName = getDmmItemMakerName(item);
  const { current, original, isOnSale } = getDmmCardPrice(item);

  const padding = size === "large" ? "p-4" : "p-3";
  const titleSize = size === "large" ? "text-base" : "text-sm";
  const priceSize = size === "large" ? "text-base" : "text-sm";

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article
      className={`group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <Link href={`/works/${item.content_id}`} prefetch className="block max-w-full">
        <div className="relative">
          <CatalogWorkImage src={imageUrl} alt={item.title} variant="portrait" />
          {isOnSale && (
            <span className="absolute left-2.5 top-2.5 z-10 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              SALE
            </span>
          )}
        </div>
        <div className={padding}>
          <h3
            className={`line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-accent ${titleSize}`}
          >
            {item.title}
          </h3>
          {releaseDate ? (
            <p className="mt-1.5 text-xs text-muted">{releaseDate}</p>
          ) : null}
          <p className="mt-1.5 text-xs text-muted">{item.content_id}</p>
          {makerName && <p className="mt-1 text-xs text-muted">{makerName}</p>}
          {current && (
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className={`font-bold text-accent ${priceSize}`}>{current}</span>
              {original && (
                <span className="text-xs text-muted line-through">{original}</span>
              )}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
