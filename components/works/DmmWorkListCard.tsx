import Image from "next/image";
import Link from "next/link";
import {
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmWorkListCardProps = {
  item: DmmItem;
};

export function DmmWorkListCard({ item }: DmmWorkListCardProps) {
  const imageUrl = getDmmListItemImageUrl(item);
  const makerName = getDmmItemMakerName(item);
  const price = getDmmItemPrice(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article className="group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md">
      <Link
        href={`/works/${item.content_id}`}
        className="block"
      >
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface">
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            className="object-cover object-center transition-transform group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 50vw, 25vw"
            unoptimized
          />
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
            {item.title}
          </h2>
          <p className="mt-1 text-xs text-muted">{item.content_id}</p>
          {makerName && (
            <p className="mt-1 text-xs text-muted">{makerName}</p>
          )}
          {price && (
            <p className="mt-1.5 text-sm font-bold text-accent">{price}</p>
          )}
        </div>
      </Link>
    </article>
  );
}
