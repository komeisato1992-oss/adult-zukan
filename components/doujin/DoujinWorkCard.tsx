import Link from "next/link";
import { DoujinAuthorLinks } from "@/components/doujin/DoujinAuthorLinks";
import { DoujinCardImage } from "@/components/doujin/DoujinCardImage";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { DoujinFavoriteCardButton } from "@/components/doujin/DoujinFavoriteCardButton";
import { DoujinProductFormatBadge } from "@/components/doujin/DoujinProductFormatBadge";
import { DoujinWorkCardCtaRow } from "@/components/doujin/DoujinWorkCardCtaRow";
import { buildDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import {
  formatDoujinPrice,
  getDoujinDiscountPercent,
} from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinWorkCardProps = {
  work: DoujinWork;
  className?: string;
  size?: "default" | "large";
};

export function DoujinWorkCard({
  work,
  className = "",
}: DoujinWorkCardProps) {
  const detailHref = `/doujin/works/${work.id}`;
  const imageUrl = getDoujinCardImage(work);
  const authorEntries = (work.authorNames ?? [])
    .map((name, index) => ({
      name,
      id: work.authorIds?.[index],
    }))
    .filter((entry) => {
      if (!entry.name.trim()) return false;
      const circleNames = work.circleNames?.length
        ? work.circleNames
        : work.circleName
          ? [work.circleName]
          : [];
      return !circleNames.some(
        (circleName) => circleName.trim() === entry.name.trim(),
      );
    });
  const authorNames = authorEntries.map((entry) => entry.name);
  const linkedAuthorIds = authorEntries.map((entry) => entry.id ?? "");
  const current = formatDoujinPrice(work.price);
  const original =
    work.isSale &&
    work.originalPrice != null &&
    work.price != null &&
    work.originalPrice > work.price
      ? formatDoujinPrice(work.originalPrice)
      : undefined;
  const discountPercent = getDoujinDiscountPercent(work);
  const affiliateUrl = buildDoujinAffiliateUrl(work);
  const ratingText =
    work.rating != null
      ? `★${work.rating.toFixed(1)}${
          work.reviewCount != null ? `（${work.reviewCount}件）` : ""
        }`
      : null;

  return (
    <article
      data-site-type="doujin"
      className={`doujin-work-card group flex h-full max-w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-accent/20 hover:shadow-xl ${className}`}
    >
      <div className="doujin-work-card__image-wrapper">
        <Link
          href={detailHref}
          prefetch
          className="absolute inset-0 z-0 block"
          aria-label={`${work.title}の詳細へ`}
        >
          <DoujinCardImage src={imageUrl} alt={work.title} />
        </Link>

        <DoujinFavoriteCardButton workId={work.id} title={work.title} />
      </div>

      <div className="doujin-work-card__body relative z-10 flex flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-3.5">
        {work.productFormatNormalized ? (
          <div className="mb-1.5">
            <DoujinProductFormatBadge
              normalizedFormat={work.productFormatNormalized}
              size="sm"
            />
          </div>
        ) : null}
        <Link href={detailHref} prefetch className="block">
          <h3 className="line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">
            {work.title}
          </h3>
        </Link>

        <DoujinCircleLinks
          circleIds={work.circleIds}
          circleNames={work.circleNames}
          circleId={work.circleId}
          circleName={work.circleName}
          className="mt-1.5 truncate text-xs text-muted"
          stopPropagation
        />

        {authorNames.length > 0 ? (
          <DoujinAuthorLinks
            authorIds={linkedAuthorIds}
            authorNames={authorNames}
            className="mt-0.5 truncate text-xs text-muted"
            stopPropagation
          />
        ) : null}

        <div className="mt-2">
          {current ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold leading-none text-price">
                  {current}
                </span>
                {discountPercent != null ? (
                  <span className="shrink-0 rounded-[4px] bg-[#FFE7A0] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#8A6400]">
                    {discountPercent}% OFF
                  </span>
                ) : null}
              </div>
              {original ? (
                <p className="mt-1 text-[0.85em] leading-none text-[#999] line-through">
                  {original}
                </p>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted">価格情報なし</span>
          )}
        </div>

        {ratingText ? (
          <p className="mt-1 text-xs text-muted">{ratingText}</p>
        ) : null}

        <div className="doujin-work-card__actions mt-auto pt-3">
          <DoujinWorkCardCtaRow
            workId={work.id}
            title={work.title}
            affiliateUrl={affiliateUrl}
          />
        </div>
      </div>
    </article>
  );
}
