import Link from "next/link";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { hasValidImage } from "@/lib/works";

type DmmRelatedWorkCardProps = {
  item: DmmItem;
};

/** 関連作品カード（PC/スマホ共通のコンパクト表示） */
export function DmmRelatedWorkCard({ item }: DmmRelatedWorkCardProps) {
  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);

  if (!hasValidImage(item) || !imageUrl) return null;

  return (
    <article className="group flex h-full max-w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <Link href={`/works/${item.content_id}`} prefetch className="block">
          <CatalogWorkImage
            src={imageUrl}
            alt={item.title}
            variant="landscape"
            sizes="(max-width: 768px) 42vw, 180px"
          />
          <div className="px-1.5 pt-1.5 pb-0 min-[769px]:px-2 min-[769px]:pt-2">
            <p className="line-clamp-3 text-[12px] font-semibold leading-[1.35] text-foreground group-hover:text-accent min-[769px]:text-[13px]">
              {item.title}
            </p>
          </div>
        </Link>
        <FavoriteCardButton contentId={item.content_id} title={item.title} />
      </div>
      <div className="flex flex-1 flex-col px-1.5 pt-0.5 pb-1.5 min-[769px]:px-2 min-[769px]:pb-2">
        <CompactNameList
          names={actressNames}
          className="text-[10px] leading-snug min-[769px]:text-[11px]"
        />
        {price ? (
          <p className="mt-0.5 text-[12px] font-bold text-price min-[769px]:text-[13px]">
            {price}
          </p>
        ) : null}
      </div>
    </article>
  );
}
