import Image from "next/image";
import Link from "next/link";
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
      className="group block overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface">
        <Image
          src={imageUrl}
          alt={item.title}
          fill
          className="object-cover object-center transition-transform group-hover:scale-[1.02]"
          sizes="(max-width: 1024px) 50vw, 25vw"
          unoptimized
        />
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
          {item.title}
        </p>
        {price && (
          <p className="mt-1 text-sm font-bold text-accent">{price}</p>
        )}
      </div>
    </Link>
  );
}
