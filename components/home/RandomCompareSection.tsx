import Link from "next/link";
import {
  RandomCompareCard,
  type RandomCompareCardData,
} from "@/components/home/RandomCompareCard";
import { WORK_CARD_VIEW_LABEL } from "@/components/works/work-card-cta-styles";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
  getDmmItemVolumeLabel,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type RandomCompareSectionProps = {
  items: [DmmItem, DmmItem];
};

function toCardData(item: DmmItem): RandomCompareCardData {
  return {
    contentId: item.content_id,
    title: item.title,
    imageUrl: getDmmItemImageUrl(item),
    price: getDmmItemPrice(item),
    actressNames: getDmmItemActressNameList(item),
    duration: getDmmItemVolumeLabel(item),
  };
}

function CompareVsBadge() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center self-center rounded-full bg-surface px-1.5 py-1 text-[10px] font-bold text-accent min-[769px]:px-3.5 min-[769px]:py-1.5 min-[769px]:text-sm"
    >
      VS
    </div>
  );
}

export function RandomCompareSection({ items }: RandomCompareSectionProps) {
  const compareUrl = `/compare?ids=${items[0].content_id},${items[1].content_id}`;
  const fanzaLinks = items
    .map((item) => ({
      contentId: item.content_id,
      title: item.title,
      url: getDmmFanzaUrl(item),
    }))
    .filter((entry) => Boolean(entry.url));

  return (
    <section
      aria-labelledby="random-compare-heading"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 min-[769px]:py-7 lg:py-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-semibold text-accent min-[769px]:text-xs">
            比較して選べる
          </span>
          <h2
            id="random-compare-heading"
            className="mt-1.5 text-base font-bold text-foreground min-[769px]:mt-2 min-[769px]:text-xl"
          >
            今日のランダム比較
          </h2>
          <p className="mt-1 text-xs leading-snug text-muted min-[769px]:mt-1.5 min-[769px]:text-sm min-[769px]:leading-relaxed">
            ページを開くたびに、ランダムで2作品を比較できます。
          </p>
        </div>

        <div className="mx-auto mt-3 max-w-4xl min-[769px]:mt-5">
          <div className="flex flex-row items-stretch gap-1.5 min-[769px]:gap-3">
            <RandomCompareCard item={toCardData(items[0])} />
            <CompareVsBadge />
            <RandomCompareCard item={toCardData(items[1])} />
          </div>

          <div className="mt-3 space-y-2 min-[769px]:mt-4 min-[769px]:space-y-2.5">
            <Link
              href={compareUrl}
              prefetch
              className="flex h-10 w-full items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover min-[769px]:mx-auto min-[769px]:h-11 min-[769px]:max-w-md"
            >
              比較ページで見る
            </Link>

            {fanzaLinks.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 min-[769px]:mx-auto min-[769px]:max-w-md">
                {fanzaLinks.map((entry) => (
                  <a
                    key={entry.contentId}
                    href={entry.url}
                    target="_blank"
                    rel={AFFILIATE_LINK_REL}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent min-[769px]:h-10 min-[769px]:text-sm"
                    title={entry.title}
                  >
                    {WORK_CARD_VIEW_LABEL}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
