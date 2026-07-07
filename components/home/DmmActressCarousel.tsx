import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getActressDetailPath } from "@/lib/actresses/slug";
import type { RankedActress } from "@/lib/works/catalog";
import { isValidImageUrl } from "@/lib/works";

type DmmActressCarouselProps = {
  actresses: RankedActress[];
  id?: string;
  title?: string;
};

export function DmmActressCarousel({
  actresses,
  id,
  title = "人気女優",
}: DmmActressCarouselProps) {
  const visibleActresses = actresses
    .filter((actress) => isValidImageUrl(actress.imageUrl))
    .slice(0, 6);

  if (visibleActresses.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title={title} href="/actresses" id={id} />
      <div className="scrollbar-hide -mx-4 flex gap-5 overflow-x-auto px-4 pb-3 pt-1 snap-x snap-mandatory sm:-mx-0 sm:px-0">
        {visibleActresses.map((actress, index) => (
          <article
            key={actress.slug}
            className="group w-[140px] shrink-0 snap-start sm:w-[160px]"
          >
            <Link href={getActressDetailPath(actress.name)} className="block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-xl">
                {actress.imageUrl && (
                  <Image
                    src={actress.imageUrl}
                    alt={actress.name}
                    fill
                    className="object-cover object-[right_center]"
                    sizes="160px"
                    loading="lazy"
                    unoptimized
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-white">{actress.name}</p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {actress.workCount}作品
                  </p>
                </div>
                {index < 3 && (
                  <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow-sm">
                    {index + 1}
                  </span>
                )}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
