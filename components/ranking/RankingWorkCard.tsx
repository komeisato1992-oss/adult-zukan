import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import { CompactNameList } from "@/components/ui/CompactNameList";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

type RankingWorkCardProps = {
  item: WorkListCardItem;
  className?: string;
  size?: "default" | "large";
};

export function RankingWorkCard({
  item,
  className = "",
  size = "default",
}: RankingWorkCardProps) {
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

  return (
    <article
      className={`group max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <div className="relative">
        <Link href={`/works/${item.contentId}`} prefetch className="block max-w-full">
          <div className="relative">
            <CatalogWorkImage
              src={item.imageUrl}
              alt={item.title}
              variant="portrait"
            />
            {item.isOnSale && (
              <span className="absolute right-2.5 top-2.5 z-10 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-white shadow-sm max-[768px]:right-1.5 max-[768px]:top-1.5 max-[768px]:px-1.5 max-[768px]:text-[10px]">
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
            {item.releaseDate ? (
              <p className="mt-1.5 text-xs text-muted max-[768px]:mt-1">
                {item.releaseDate}
              </p>
            ) : null}
          </div>
        </Link>
        <FavoriteCardButton contentId={item.contentId} title={item.title} />
      </div>
      <div className={`${paddingX} pt-1.5 max-[768px]:pt-1`}>
        <CompactNameList
          names={item.actressNames}
          className="max-[768px]:text-[13px]"
        />
        {item.displayPrice ? (
          <div className="mt-2.5 flex items-baseline gap-2 max-[768px]:mt-1.5">
            <span className={`font-bold text-price ${priceSize}`}>
              {item.displayPrice}
            </span>
            {item.originalPrice ? (
              <span className="text-xs text-muted line-through">
                {item.originalPrice}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="mt-1 truncate text-[11px] text-muted/90">{item.contentId}</p>
      </div>
      <div className={`${paddingX} pb-3 max-[768px]:pb-2`}>
        <WorkCardCtaRow
          contentId={item.contentId}
          title={item.title}
          fanzaUrl={item.fanzaUrl}
        />
      </div>
    </article>
  );
}
