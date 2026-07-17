import Image from "next/image";
import Link from "next/link";
import { MultiActressPackageBanner } from "@/components/actresses/MultiActressPackageBanner";
import { MoreSeeScrollCard } from "@/components/home/MoreSeeScrollCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getActressDetailPath } from "@/lib/actresses/slug";
import type { RankedActress } from "@/lib/works/catalog";
import { HOME_SECTION_DISPLAY_LIMIT } from "@/lib/pagination";
import { isValidImageUrl } from "@/lib/works";

const ACTRESSES_MORE_HREF = "/actresses?sort=works";

type DmmActressCarouselProps = {
  actresses: RankedActress[];
  id?: string;
  title?: string;
  href?: string;
};

export function DmmActressCarousel({
  actresses,
  id,
  title = "人気女優",
  href = ACTRESSES_MORE_HREF,
}: DmmActressCarouselProps) {
  const visibleActresses = actresses
    .filter((actress) => actress.workCount >= 1)
    .slice(0, HOME_SECTION_DISPLAY_LIMIT);

  if (visibleActresses.length === 0) return null;

  const sectionLabel =
    title.replace(/^[^0-9A-Za-zぁ-んァ-ヶー一-龥]+/, "").trim() || title;

  return (
    <section aria-labelledby={id} className="mb-7 min-[769px]:mb-12">
      <SectionHeader title={title} href={href} id={id} />
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-1 snap-x snap-mandatory min-[769px]:-mx-0 min-[769px]:gap-5 min-[769px]:px-0 min-[769px]:pb-3">
        {visibleActresses.map((actress, index) => (
          <article
            key={actress.slug}
            className="group w-[96px] shrink-0 snap-start min-[769px]:w-[160px]"
          >
            <Link href={getActressDetailPath(actress.name)} className="block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-xl">
                {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
                  <Image
                    src={actress.imageUrl}
                    alt={actress.name}
                    fill
                    className="object-cover object-[right_center]"
                    sizes="(max-width: 768px) 96px, 160px"
                    loading="lazy"
                    unoptimized
                  />
                ) : null}
                {actress.imageFromMultiActressWork ? (
                  <MultiActressPackageBanner />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2 min-[769px]:p-3">
                  <p className="line-clamp-2 text-[11px] font-bold leading-snug text-white min-[769px]:text-sm">
                    {actress.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/70 min-[769px]:text-xs">
                    {actress.workCount}作品
                  </p>
                </div>
                {index < 3 && (
                  <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm min-[769px]:left-2.5 min-[769px]:top-2.5 min-[769px]:h-7 min-[769px]:w-7 min-[769px]:text-xs">
                    {index + 1}
                  </span>
                )}
              </div>
            </Link>
          </article>
        ))}
        <MoreSeeScrollCard
          href={href}
          sectionLabel={sectionLabel}
          className="w-[88px] min-h-[128px] min-[769px]:w-[140px] min-[769px]:min-h-[213px]"
        />
      </div>
    </section>
  );
}
