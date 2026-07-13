import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import type { Work } from "@/data/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { formatPrice, getDisplayPrice } from "@/lib/format";
import { CompactNameList } from "@/components/ui/CompactNameList";
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

  const paddingX = size === "large" ? "px-4" : "px-3";
  const titleSize = size === "large" ? "text-base" : "text-sm";
  const priceSize = size === "large" ? "text-base" : "text-sm";

  const media = (
    <div className="relative">
      <WorkThumbnail
        title={work.title}
        variant="card"
        showHoverOverlay
        className="aspect-[2/3]"
      />
      {isOnSale && (
        <span className="absolute right-2.5 top-2.5 z-10 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          SALE
        </span>
      )}
    </div>
  );

  const titleBlock = (
    <div className={`${paddingX} pt-3 pb-0`}>
      <h3
        className={`line-clamp-2 font-semibold leading-snug text-foreground transition-colors group-hover:text-accent ${titleSize}`}
      >
        {work.title}
      </h3>
    </div>
  );

  return (
    <article
      className={`group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <div className="relative">
        {linkToDetail ? (
          <Link href={`/works/${work.slug}`} className="block">
            {media}
            {titleBlock}
          </Link>
        ) : (
          <a
            href={work.affiliateUrl}
            target="_blank"
            rel={AFFILIATE_LINK_REL}
            className="block"
          >
            {media}
            {titleBlock}
          </a>
        )}
        {work.contentId ? (
          <FavoriteCardButton contentId={work.contentId} title={work.title} />
        ) : null}
      </div>
      <div className={`${paddingX} pt-1.5`}>
        <CompactNameList names={work.actressNames} />
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className={`font-bold text-price ${priceSize}`}>
            {formatPrice(current)}
          </span>
          {original && (
            <span className="text-xs text-muted line-through">
              {formatPrice(original)}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted/90">{work.productCode}</p>
      </div>
      {work.contentId ? (
        <div className={`${paddingX} pb-3`}>
          <WorkCardCtaRow
            contentId={work.contentId}
            title={work.title}
            fanzaUrl={work.affiliateUrl}
          />
        </div>
      ) : null}
    </article>
  );
}
