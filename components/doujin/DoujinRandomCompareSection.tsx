import { DoujinAuthorLinks } from "@/components/doujin/DoujinAuthorLinks";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { buildDoujinAffiliateUrl, isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import { formatDoujinPrice } from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

type DoujinRandomCompareSectionProps = {
  items: [DoujinWork, DoujinWork];
};

function RandomCompareCard({ work }: { work: DoujinWork }) {
  const imageUrl = getDoujinCardImage(work);
  const price = formatDoujinPrice(work.price);

  return (
    <article className="flex min-w-0 flex-1 gap-3 rounded-xl border border-border bg-white p-3 shadow-sm sm:gap-4 sm:p-3.5">
      <div className="min-w-0 flex-1">
        <Link
          href={`/doujin/works/${work.id}`}
          prefetch
          className="line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors hover:text-accent"
        >
          {work.title}
        </Link>

        <dl className="mt-2 space-y-1 text-xs sm:text-sm">
          <div>
            <dt className="inline text-foreground">サークル：</dt>
            <dd className="inline">
              <DoujinCircleLinks
                circleIds={work.circleIds}
                circleNames={work.circleNames}
                circleId={work.circleId}
                circleName={work.circleName}
                className="inline text-xs sm:text-sm"
                variant="link"
                separator="、"
                stopPropagation
              />
              {!work.circleName && !(work.circleNames?.length) ? "-" : null}
            </dd>
          </div>
          <div>
            <dt className="inline text-foreground">作者：</dt>
            <dd className="inline">
              {(work.authorNames ?? []).length > 0 ? (
                <DoujinAuthorLinks
                  authorIds={work.authorIds}
                  authorNames={work.authorNames}
                  className="inline text-xs sm:text-sm"
                  variant="link"
                  separator="、"
                  stopPropagation
                />
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">価格：</dt>
            <dd className="inline font-bold text-price">{price ?? "-"}</dd>
          </div>
        </dl>
      </div>

      <Link
        href={`/doujin/works/${work.id}`}
        prefetch
        className="ml-auto shrink-0 self-start"
        aria-label={`${work.title} の作品ページへ`}
      >
        <Image
          src={imageUrl}
          alt={work.title}
          width={160}
          height={120}
          className="h-auto w-[100px] max-w-[100px] rounded-lg object-contain object-center sm:w-[115px] sm:max-w-[115px] md:ml-2 md:w-[130px] md:max-w-[130px]"
          unoptimized
        />
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

export function DoujinRandomCompareSection({
  items,
}: DoujinRandomCompareSectionProps) {
  const compareUrl = `/doujin/compare?ids=${items[0].id},${items[1].id}`;
  const fanzaLinks = items
    .map((work) => ({
      id: work.id,
      title: work.title,
      url: buildDoujinAffiliateUrl(work),
    }))
    .filter((entry) => isValidDoujinAffiliateUrl(entry.url));

  return (
    <section
      aria-labelledby="doujin-random-compare-heading"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-7 lg:py-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-semibold text-accent sm:text-xs">
            比較して選べる
          </span>
          <h2
            id="doujin-random-compare-heading"
            className="mt-2 text-lg font-bold text-foreground sm:text-xl"
          >
            今日のランダム同人比較
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
            ページを開くたびに、ランダムで2作品を比較できます。
          </p>
        </div>

        <div className="mx-auto mt-5 max-w-4xl">
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-3">
            <RandomCompareCard work={items[0]} />
            <CompareVsBadge />
            <RandomCompareCard work={items[1]} />
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
                    key={entry.id}
                    href={entry.url}
                    target="_blank"
                    rel={AFFILIATE_LINK_REL}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-2 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent sm:text-sm"
                    title={entry.title}
                  >
                    作品を見る
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
