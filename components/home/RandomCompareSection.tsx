import Image from "next/image";
import Link from "next/link";
import { imageCoverClassName } from "@/components/ui/image-cover";
import { WORK_CARD_VIEW_LABEL } from "@/components/works/work-card-cta-styles";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type RandomCompareSectionProps = {
  items: [DmmItem, DmmItem];
};

function RandomCompareCard({ item }: { item: DmmItem }) {
  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);

  return (
    <article className="flex min-w-0 flex-1 gap-3 rounded-xl border border-border bg-white p-3 shadow-sm sm:gap-4 sm:p-3.5">
      <div className="min-w-0 flex-1">
        <Link
          href={`/works/${item.content_id}`}
          prefetch
          className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors hover:text-accent"
        >
          {item.title}
        </Link>

        <dl className="mt-2 space-y-1 text-xs sm:text-sm">
          <div>
            <dt className="inline text-muted">女優：</dt>
            <dd className="inline text-foreground">
              {actressNames.length > 0 ? actressNames.join("、") : "-"}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">価格：</dt>
            <dd className="inline font-bold text-price">{price ?? "-"}</dd>
          </div>
        </dl>
      </div>

      <Link
        href={`/works/${item.content_id}`}
        prefetch
        className="ml-auto shrink-0 self-start"
        aria-label={`${item.title} の作品ページへ`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            width={120}
            height={170}
            className={`h-auto w-[100px] max-w-[100px] rounded-lg sm:w-[115px] sm:max-w-[115px] md:ml-2 md:w-[130px] md:max-w-[130px] ${imageCoverClassName}`}
            unoptimized
          />
        ) : (
          <div className="h-[150px] w-[100px] rounded-lg bg-surface sm:w-[115px] md:w-[130px]" />
        )}
      </Link>
    </article>
  );
}

function CompareVsBadge() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center self-center rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-accent sm:px-3.5 sm:text-sm"
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7 lg:py-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-semibold text-accent sm:text-xs">
            比較して選べる
          </span>
          <h2
            id="random-compare-heading"
            className="mt-2 text-lg font-bold text-foreground sm:text-xl"
          >
            今日のランダム比較
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
            ページを開くたびに、ランダムで2作品を比較できます。
          </p>
        </div>

        <div className="mx-auto mt-5 max-w-4xl">
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-3">
            <RandomCompareCard item={items[0]} />
            <CompareVsBadge />
            <RandomCompareCard item={items[1]} />
          </div>

          <div className="mt-4 space-y-2.5">
            <Link
              href={compareUrl}
              prefetch
              className="flex h-11 w-full items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:mx-auto sm:max-w-md"
            >
              比較ページで見る
            </Link>

            {fanzaLinks.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:mx-auto sm:max-w-md">
                {fanzaLinks.map((entry) => (
                  <a
                    key={entry.contentId}
                    href={entry.url}
                    target="_blank"
                    rel={AFFILIATE_LINK_REL}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent sm:text-sm"
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
