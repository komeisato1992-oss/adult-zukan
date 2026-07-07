import Link from "next/link";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { getDmmItemImageUrl, getDmmItemPrice } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmRelatedWorkCardProps = {
  item: DmmItem;
};

export function DmmRelatedWorkCard({ item }: DmmRelatedWorkCardProps) {
  const imageUrl = getDmmItemImageUrl(item);
  const price = getDmmItemPrice(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <Link
      href={`/works/${item.content_id}`}
      prefetch
      className="group block max-w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
    >
      <CatalogWorkImage
        src={imageUrl}
        alt={item.title}
        variant="landscape"
        sizes="(max-width: 1024px) 50vw, 25vw"
      />
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
          {item.title}
        </p>
        {price && <p className="mt-1 text-sm font-bold text-accent">{price}</p>}
      </div>
    </Link>
  );
}
