import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { WorkCardCtaRow } from "@/components/works/WorkCardCtaRow";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmRelatedWorkCardProps = {
  item: DmmItem;
};

export function DmmRelatedWorkCard({ item }: DmmRelatedWorkCardProps) {
  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article className="group block max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <div className="relative">
        <Link
          href={`/works/${item.content_id}`}
          prefetch
          className="block"
        >
          <CatalogWorkImage
            src={imageUrl}
            alt={item.title}
            variant="landscape"
            sizes="(max-width: 1024px) 50vw, 25vw"
          />
          <div className="px-3 pt-3 pb-0 max-[768px]:px-2 max-[768px]:pt-2">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent max-[768px]:line-clamp-3 max-[768px]:text-[15px]">
              {item.title}
            </p>
          </div>
        </Link>
        <FavoriteCardButton contentId={item.content_id} title={item.title} />
      </div>
      <div className="px-3 pt-1 max-[768px]:px-2 max-[768px]:pt-0.5">
        <CompactNameList
          names={actressNames}
          className="max-[768px]:text-[13px]"
        />
        {price && (
          <p className="mt-1 text-sm font-bold text-price max-[768px]:text-[15px]">
            {price}
          </p>
        )}
        <p className="mt-1 truncate text-[11px] text-muted/90">{item.content_id}</p>
      </div>
      <div className="px-3 pb-3 max-[768px]:px-2 max-[768px]:pb-2">
        <WorkCardCtaRow
          contentId={item.content_id}
          title={item.title}
          fanzaUrl={getDmmFanzaUrl(item)}
        />
      </div>
    </article>
  );
}
