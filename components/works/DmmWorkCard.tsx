"use client";

import Link from "next/link";
import { useState } from "react";
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
  /** トップ横スクロール向け（スマホ約2/3サイズ） */
  compact?: boolean;
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
  compact = false,
}: DmmWorkCardProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const { current, original, isOnSale } = getDmmCardPrice(item);

  const paddingX = compact
    ? "px-4 max-[768px]:px-1"
    : size === "large"
      ? "px-4 max-[768px]:px-1.5"
      : "px-3 max-[768px]:px-1.5";
  const titleSize = compact
    ? "text-base max-[768px]:text-[11px]"
    : size === "large"
      ? "text-base max-[768px]:text-[13px]"
      : "text-sm max-[768px]:text-[13px]";
  const priceSize = compact
    ? "text-base max-[768px]:text-[11px]"
    : size === "large"
      ? "text-base max-[768px]:text-[13px]"
      : "text-sm max-[768px]:text-[13px]";

  const [hidden, setHidden] = useState(false);
  if (!hasValidImage(item) || !imageUrl || hidden) return null;

  return (
    <article
      className={`group flex h-full max-w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <div className="relative">
        <Link href={`/works/${item.content_id}`} prefetch className="block max-w-full">
          <div className="relative">
            <CatalogWorkImage
              src={imageUrl}
              alt={item.title}
              variant="portrait"
              sizes={
                compact
                  ? "(max-width: 768px) 112px, 216px"
                  : "(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw"
              }
              onLoadError={() => setHidden(true)}
            />
            {isOnSale && (
              <span className="absolute right-2.5 top-2.5 z-10 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-white shadow-sm max-[768px]:right-1 max-[768px]:top-1 max-[768px]:px-1 max-[768px]:text-[9px]">
                SALE
              </span>
            )}
          </div>
          <div
            className={`${paddingX} pt-3 pb-0 ${compact ? "max-[768px]:pt-1" : "max-[768px]:pt-1.5"}`}
          >
            <h3
              className={`line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-accent max-[768px]:leading-[1.35] ${compact ? "" : "max-[768px]:line-clamp-3 max-[768px]:leading-[1.4]"} ${titleSize}`}
            >
              {item.title}
            </h3>
            {releaseDate ? (
              <p className="mt-1.5 text-xs text-muted max-[768px]:hidden">
                {releaseDate}
              </p>
            ) : null}
          </div>
        </Link>
        <FavoriteCardButton contentId={item.content_id} title={item.title} />
      </div>
      <div className={`flex flex-1 flex-col ${paddingX} pt-1.5 max-[768px]:pt-0.5`}>
        <CompactNameList
          names={actressNames}
          className={compact ? "max-[768px]:text-[10px]" : "max-[768px]:text-[11px]"}
        />
        {current && (
          <div
            className={`mt-2.5 flex items-baseline gap-2 ${compact ? "max-[768px]:mt-0.5" : "max-[768px]:mt-1"}`}
          >
            <span className={`font-bold text-price ${priceSize}`}>{current}</span>
            {original && (
              <span
                className={`text-xs text-muted line-through ${compact ? "max-[768px]:text-[9px]" : "max-[768px]:text-[10px]"}`}
              >
                {original}
              </span>
            )}
          </div>
        )}
        <p className="mt-1 truncate text-[11px] text-muted/90 max-[768px]:hidden">
          {item.content_id}
        </p>
        <div
          className={`mt-auto pb-3 pt-2 ${compact ? "max-[768px]:pb-1 max-[768px]:pt-1" : "max-[768px]:pb-1.5 max-[768px]:pt-1.5"}`}
        >
          <WorkCardCtaRow
            contentId={item.content_id}
            title={item.title}
            fanzaUrl={getDmmFanzaUrl(item)}
            compact={compact}
          />
        </div>
      </div>
    </article>
  );
}
