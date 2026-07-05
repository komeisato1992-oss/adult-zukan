import Link from "next/link";
import type { Work } from "@/data/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { formatPrice, getDisplayPrice } from "@/lib/format";
import { WorkThumbnail } from "@/components/ui/WorkThumbnail";

type WorkCardProps = {
  work: Work;
  className?: string;
  size?: "default" | "large";
  linkToDetail?: boolean;
};

export function WorkCard({
  work,
  className = "",
  size = "default",
  linkToDetail = false,
}: WorkCardProps) {
  const { current, original, isOnSale } = getDisplayPrice(work);

  const padding = size === "large" ? "p-4" : "p-3";
  const titleSize = size === "large" ? "text-base" : "text-sm";
  const priceSize = size === "large" ? "text-base" : "text-sm";

  const inner = (
    <>
      <div className="relative">
        <WorkThumbnail
          title={work.title}
          variant="card"
          showHoverOverlay
          className="aspect-[2/3]"
        />
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
          {work.title}
        </h3>
        <p className="mt-1.5 text-xs text-muted">{work.productCode}</p>
        <p className="mt-1 text-xs text-muted">{work.makerName}</p>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className={`font-bold text-accent ${priceSize}`}>
            {formatPrice(current)}
          </span>
          {original && (
            <span className="text-xs text-muted line-through">
              {formatPrice(original)}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <article
      className={`group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      {linkToDetail ? (
        <Link href={`/works/${work.slug}`} className="block">
          {inner}
        </Link>
      ) : (
        <a
          href={work.affiliateUrl}
          target="_blank"
          rel={AFFILIATE_LINK_REL}
          className="block"
        >
          {inner}
        </a>
      )}
    </article>
  );
}
