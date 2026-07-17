import Image from "next/image";
import Link from "next/link";
import { imageCoverClassName } from "@/components/ui/image-cover";
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

/** 女優名を1行用に要約。+0名は出さない */
function formatActressSummary(
  names: string[],
  maxVisible: number,
): string {
  if (names.length === 0) return "-";
  const visibleCount = Math.min(maxVisible, names.length);
  const visible = names.slice(0, visibleCount);
  const rest = names.length - visibleCount;
  const label = visible.join("、");
  if (rest > 0) return `${label} +${rest}名`;
  return label;
}

function RandomCompareCard({ item }: { item: DmmItem }) {
  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const price = getDmmItemPrice(item);
  const duration = getDmmItemVolumeLabel(item) ?? "-";
  const actressMobile = formatActressSummary(actressNames, 1);
  const actressDesktop = formatActressSummary(actressNames, 2);

  return (
    <article className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm min-[769px]:flex-row min-[769px]:gap-4 min-[769px]:rounded-xl min-[769px]:p-3.5">
      {/* スマホ: カード横幅100%のパッケージ画像（縦横比維持・object-contain） */}
      <Link
        href={`/works/${item.content_id}`}
        prefetch
        className="relative block w-full shrink-0 overflow-hidden rounded-t-lg bg-surface min-[769px]:hidden"
        aria-label={`${item.title} の作品ページへ`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            width={400}
            height={600}
            sizes="(max-width: 768px) 45vw, 130px"
            className="h-auto w-full object-contain"
            unoptimized
          />
        ) : (
          <div className="aspect-[2/3] w-full bg-surface" />
        )}
      </Link>

      {/* PC: 従来どおり横並びの小さめ画像 */}
      <Link
        href={`/works/${item.content_id}`}
        prefetch
        className="ml-auto hidden shrink-0 self-start min-[769px]:order-2 min-[769px]:block"
        aria-label={`${item.title} の作品ページへ`}
        tabIndex={-1}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={120}
            height={170}
            className={`h-auto w-[115px] max-w-[115px] rounded-lg md:ml-2 md:w-[130px] md:max-w-[130px] ${imageCoverClassName}`}
            unoptimized
          />
        ) : (
          <div className="h-[150px] w-[115px] rounded-lg bg-surface md:w-[130px]" />
        )}
      </Link>

      <div className="min-w-0 flex-1 px-1.5 py-1.5 min-[769px]:order-1 min-[769px]:px-0 min-[769px]:py-0">
        <Link
          href={`/works/${item.content_id}`}
          prefetch
          className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground transition-colors hover:text-accent min-[769px]:text-sm"
        >
          {item.title}
        </Link>

        <dl className="mt-1 space-y-0.5 text-[10px] leading-tight min-[769px]:mt-2 min-[769px]:space-y-1 min-[769px]:text-sm min-[769px]:leading-normal">
          <div>
            <dt className="inline text-muted">価格：</dt>
            <dd className="inline font-bold text-price">{price ?? "-"}</dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-0">
            <dt className="shrink-0 text-muted">女優：</dt>
            <dd className="min-w-0 truncate text-foreground min-[769px]:hidden">
              {actressMobile}
            </dd>
            <dd className="hidden min-w-0 truncate text-foreground min-[769px]:inline">
              {actressDesktop}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">再生時間：</dt>
            <dd className="inline text-foreground">{duration}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
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
            <RandomCompareCard item={items[0]} />
            <CompareVsBadge />
            <RandomCompareCard item={items[1]} />
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
