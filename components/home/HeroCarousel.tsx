"use client";

import { useCallback, useEffect, useState } from "react";
import type { Work } from "@/data/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { formatPrice, getDisplayPrice } from "@/lib/format";
import { WorkThumbnail } from "@/components/ui/WorkThumbnail";

type HeroCarouselProps = {
  works: Work[];
};

export function HeroCarousel({ works }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + works.length) % works.length);
    },
    [works.length],
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (isPaused || works.length <= 1) return;

    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [isPaused, goNext, works.length]);

  if (works.length === 0) return null;

  const work = works[current];
  const { current: price, original, isOnSale } = getDisplayPrice(work);

  return (
    <section
      aria-label="おすすめ作品"
      aria-roledescription="carousel"
      className="relative w-full overflow-hidden bg-neutral-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative mx-auto aspect-[16/7] max-h-[520px] w-full max-w-[1400px] sm:aspect-[21/8]">
        {works.map((item, index) => (
          <div
            key={item.slug}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === current ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={index !== current}
          >
            <WorkThumbnail title={item.title} variant="hero" className="h-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        ))}

        <div className="relative flex h-full items-end px-5 pb-10 pt-16 sm:items-center sm:px-10 sm:pb-12 lg:px-14">
          <div className="max-w-xl">
            {isOnSale && (
              <span className="mb-3 inline-block rounded-sm bg-accent px-2.5 py-1 text-xs font-bold text-white">
                セール中
              </span>
            )}
            <p className="text-sm font-medium text-white/70">{work.productCode}</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl">
              {work.title}
            </h2>
            {work.makerName && (
              <p className="mt-2 text-sm text-white/60">{work.makerName}</p>
            )}
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/80 sm:text-base">
              {work.description}
            </p>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-white">
                {formatPrice(price)}
              </span>
              {original && (
                <span className="text-sm text-white/50 line-through">
                  {formatPrice(original)}
                </span>
              )}
            </div>
            <a
              href={work.affiliateUrl}
              target="_blank"
              rel={AFFILIATE_LINK_REL}
              className="mt-6 inline-flex h-11 items-center rounded bg-accent px-8 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              FANZAで見る
            </a>
          </div>
        </div>

        {works.length > 1 && (
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
              {works.map((item, index) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`${item.title}を表示`}
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
