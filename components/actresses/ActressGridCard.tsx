import Link from "next/link";
import { PortraitImage } from "@/components/ui/PortraitImage";
import { getActressDetailPath } from "@/lib/actresses/slug";
import type { ActressListItem } from "@/lib/actresses/sort";
import { isValidImageUrl } from "@/lib/works";

type ActressGridCardProps = {
  actress: ActressListItem;
};

export function ActressGridCard({ actress }: ActressGridCardProps) {
  return (
    <Link
      href={getActressDetailPath(actress.name)}
      prefetch
      className="group block overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
        <PortraitImage
          src={actress.imageUrl}
          alt={actress.name}
          sizes="200px"
        />
      ) : (
        <div className="relative aspect-[3/4] bg-surface" />
      )}
      <div className="p-3">
        <p className="text-sm font-semibold text-foreground group-hover:text-accent">
          {actress.name}
        </p>
        <p className="mt-1 text-xs text-muted">{actress.workCount}作品</p>
      </div>
    </Link>
  );
}
