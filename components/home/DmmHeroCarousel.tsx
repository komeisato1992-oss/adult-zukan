"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getDmmItemMakerName,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { hasValidImage } from "@/lib/works";

type DmmHeroCarouselProps = {
  items: DmmItem[];
};

function getHeroPrice(item: DmmItem) {
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

export function DmmHeroCarousel({ items }: DmmHeroCarouselProps) {
  const visibleItems = items.filter(hasValidImage);

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + visibleItems.length) % visibleItems.length);
    },
    [visibleItems.length],
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (isPaused || visibleItems.length <= 1) return;

    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [isPaused, goNext, visibleItems.length]);

  if (visibleItems.length === 0) return null;

  const item = visibleItems[current];
  const imageUrl = getDmmListItemImageUrl(item);
  const makerName = getDmmItemMakerName(item);
  const { current: price, original, isOnSale } = getHeroPrice(item);

  if (!imageUrl) return null;

  return (
    <section
      aria-label="おすすめ作品"
      aria-roledescription="carousel"
      className="relative w-full overflow-hidden bg-neutral-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="work-image-frame work-image-frame--hero relative mx-auto aspect-[16/7] max-h-[520px] w-full max-w-[1400px] overflow-hidden sm:aspect-[21/8]">
        {visibleItems.map((slide, index) => {
          const slideImage = getDmmListItemImageUrl(slide);
          if (!slideImage) return null;

          return (
            <div
              key={slide.content_id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                index === current
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              aria-hidden={index !== current}
            >
              <Image
                src={slideImage}
                alt={slide.title}
                fill
                className="catalog-work-image object-cover object-[right_center]"
                style={{
                  objectFit: "cover",
                  objectPosition: "right center",
                  maxWidth: "100%",
                }}
                sizes="100vw"
                priority={index === 0}
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          );
        })}

        <div className="relative flex h-full items-end px-5 pb-10 pt-16 sm:items-center sm:px-10 sm:pb-12 lg:px-14">
          <div className="max-w-xl">
            {isOnSale && (
              <span className="mb-3 inline-block rounded-sm bg-accent px-2.5 py-1 text-xs font-bold text-white">
                セール中
              </span>
            )}
            <p className="text-sm font-medium text-white/70">{item.content_id}</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl">
              {item.title}
            </h2>
            {makerName && (
              <p className="mt-2 text-sm text-white/60">{makerName}</p>
            )}
            {price && (
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-white">{price}</span>
                {original && (
                  <span className="text-sm text-white/50 line-through">
                    {original}
                  </span>
                )}
              </div>
            )}
            <Link
              href={`/works/${item.content_id}`}
              className="mt-6 inline-flex h-11 items-center rounded bg-accent px-8 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              作品を見る
            </Link>
          </div>
        </div>

        {visibleItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="前のスライド"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:left-5"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="次のスライド"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-5"
            >
              ›
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {visibleItems.map((slide, index) => (
                <button
                  key={slide.content_id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`${slide.title}を表示`}
                  aria-current={index === current ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all ${
                    index === current
                      ? "w-8 bg-accent"
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
