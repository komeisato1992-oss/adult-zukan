"use client";

import Image from "next/image";
import Link from "next/link";
import { DoujinAuthorComment } from "@/components/doujin/DoujinAuthorComment";
import { DoujinAuthorLinks } from "@/components/doujin/DoujinAuthorLinks";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { DoujinCompareToggleButton } from "@/components/doujin/DoujinCompareToggleButton";
import { DoujinFavoriteButton } from "@/components/doujin/DoujinFavoriteButton";
import { DoujinGenreLinks } from "@/components/doujin/DoujinGenreLinks";
import { DoujinProductFormatBadge } from "@/components/doujin/DoujinProductFormatBadge";
import { DoujinSeriesLink } from "@/components/doujin/DoujinSeriesLink";
import { isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { buildDoujinFirstTimeGuideHref } from "@/lib/doujin/first-time-guide";
import {
  formatDoujinPrice,
  getDoujinDiscountPercent,
} from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import {
  doujinWorkCardCtaBaseClassName,
  WORK_CARD_VIEW_LABEL,
} from "@/components/works/work-card-cta-styles";

type DoujinWorkHeroProps = {
  work: DoujinWork;
  imageUrl?: string;
  teaser: string;
  affiliateUrl: string;
  hasSampleImages: boolean;
  authorComment?: string;
  showFirstTimeGuide?: boolean;
};

export function DoujinWorkHero({
  work,
  imageUrl,
  teaser,
  affiliateUrl,
  hasSampleImages,
  authorComment,
  showFirstTimeGuide = false,
}: DoujinWorkHeroProps) {
  const current = formatDoujinPrice(work.price);
  const original =
    work.isSale &&
    work.originalPrice != null &&
    work.price != null &&
    work.originalPrice > work.price
      ? formatDoujinPrice(work.originalPrice)
      : undefined;
  const discountPercent = getDoujinDiscountPercent(work);
  const validAffiliate = isValidDoujinAffiliateUrl(affiliateUrl);
  const hasAuthors = (work.authorNames ?? []).length > 0;
  const hasCircles = Boolean(
    work.circleName || (work.circleNames?.length ?? 0) > 0,
  );
  const hasSeries = Boolean(work.seriesName);
  const hasGenres = (work.genreNames ?? []).length > 0;
  const ratingText =
    work.rating != null
      ? `★${work.rating.toFixed(1)}${
          work.reviewCount != null ? `（${work.reviewCount}件）` : ""
        }`
      : null;
  const guideHref = buildDoujinFirstTimeGuideHref(work.id);

  return (
    <section
      aria-label="作品概要"
      className="rounded-none border-0 bg-transparent p-0 shadow-none"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,42%)_1fr] lg:items-start lg:gap-10">
        <div className="order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0 lg:max-w-none">
          {imageUrl ? (
            <div className="doujin-work-detail__image-frame">
              <Image
                src={imageUrl}
                alt={work.title}
                width={640}
                height={640}
                className="doujin-work-detail__image"
                sizes="(max-width: 1024px) 100vw, 42vw"
                priority
                unoptimized
              />
            </div>
          ) : (
            <div className="doujin-work-detail__image-frame flex min-h-[200px] items-center justify-center text-sm text-muted">
              画像なし
            </div>
          )}

          {hasSampleImages ? (
            <a
              href="#doujin-sample-images-title"
              className="mt-3 inline-flex text-sm font-medium text-[#2563EB] hover:underline"
            >
              サンプル画像を見る →
            </a>
          ) : null}
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          {work.productFormatNormalized ? (
            <div className="mb-2">
              <DoujinProductFormatBadge
                normalizedFormat={work.productFormatNormalized}
                size="md"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight text-foreground sm:text-2xl lg:text-3xl">
              {work.title}
            </h1>
            <DoujinFavoriteButton workId={work.id} title={work.title} />
          </div>

          {teaser ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
              {teaser}
            </p>
          ) : null}

          <dl className="mt-6 space-y-3 text-sm">
            {hasCircles ? (
              <div>
                <dt className="text-muted">サークル</dt>
                <dd className="mt-0.5 text-foreground">
                  <DoujinCircleLinks
                    circleIds={work.circleIds}
                    circleNames={work.circleNames}
                    circleId={work.circleId}
                    circleName={work.circleName}
                    variant="link"
                    separator="、"
                  />
                </dd>
              </div>
            ) : null}

            {hasAuthors ? (
              <div>
                <dt className="text-muted">作者</dt>
                <dd className="mt-0.5 text-foreground">
                  <DoujinAuthorLinks
                    authorIds={work.authorIds}
                    authorNames={work.authorNames}
                    variant="link"
                    separator="、"
                  />
                </dd>
              </div>
            ) : null}

            {hasSeries ? (
              <div>
                <dt className="text-muted">シリーズ</dt>
                <dd className="mt-0.5 text-foreground">
                  <DoujinSeriesLink
                    seriesId={work.seriesId}
                    seriesName={work.seriesName}
                    variant="link"
                  />
                </dd>
              </div>
            ) : null}

            {current || original ? (
              <div>
                <dt className="text-muted">価格</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  {current ? (
                    <span className="text-xl font-bold text-price [color:var(--price-color,#E60012)]">
                      {current}
                    </span>
                  ) : null}
                  {original ? (
                    <span className="text-sm text-muted line-through">
                      {original}
                    </span>
                  ) : null}
                  {discountPercent != null ? (
                    <span className="text-sm font-semibold text-price [color:var(--price-color,#E60012)]">
                      {discountPercent}% OFF
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>

          {authorComment ? (
            <DoujinAuthorComment text={authorComment} />
          ) : null}

          <dl className="mt-4 space-y-3 text-sm">
            {ratingText ? (
              <div>
                <dt className="text-muted">評価</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {ratingText}
                </dd>
              </div>
            ) : null}

            {work.releaseDate ? (
              <div>
                <dt className="text-muted">配信日</dt>
                <dd className="mt-0.5 text-foreground">{work.releaseDate}</dd>
              </div>
            ) : null}

            {hasGenres ? (
              <div>
                <dt className="text-muted">ジャンル</dt>
                <dd className="mt-0.5 text-foreground">
                  <DoujinGenreLinks
                    genreIds={work.genreIds}
                    genreNames={work.genreNames}
                    variant="link"
                    separator="、"
                    emptyFallback={null}
                  />
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 w-full max-w-[300px]">
            <div className="flex flex-nowrap items-stretch gap-1.5 sm:gap-2">
              <div className="min-w-0 basis-[40%]">
                <DoujinCompareToggleButton
                  workId={work.id}
                  title={work.title}
                  variant="card"
                />
              </div>
              {validAffiliate ? (
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel={AFFILIATE_LINK_REL}
                  className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] bg-accent text-white transition-colors hover:bg-accent-hover`}
                >
                  {WORK_CARD_VIEW_LABEL}
                </a>
              ) : (
                <span
                  className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] cursor-not-allowed border border-border bg-surface text-muted`}
                >
                  リンク準備中
                </span>
              )}
            </div>

            {showFirstTimeGuide ? (
              <div className="mt-3 flex justify-center">
                <Link
                  href={guideHref}
                  className="inline-flex items-center justify-center rounded-md border border-[#E8C98A] bg-[#FFF6E4] px-3 py-2 text-center text-[12px] font-medium leading-none text-[#8A6A2E] transition-colors hover:border-[#D4B46E] hover:bg-[#FFEFC8] hover:text-[#6F5420] sm:text-[13px]"
                >
                  初めて利用する方はこちら ＞
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
