import Link from "next/link";
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
        <div className="px-3 pt-3 pb-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
            {item.title}
          </p>
        </div>
      </Link>
      <div className="px-3 pt-1">
        <CompactNameList names={actressNames} />
        {price && <p className="mt-1 text-sm font-bold text-accent">{price}</p>}
        <p className="mt-1 text-[11px] text-muted/90">{item.content_id}</p>
      </div>
      <div className="px-3 pb-3">
        <WorkCardCtaRow
          contentId={item.content_id}
          fanzaUrl={getDmmFanzaUrl(item)}
        />
      </div>
    </article>
  );
}
