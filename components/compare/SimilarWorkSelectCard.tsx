"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { CompactNameList } from "@/components/ui/CompactNameList";
import { setCompareIds } from "@/components/compare/compare-store";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import type { SimilarWorkCardData } from "@/lib/compare/types";
import { formatPriceYen } from "@/lib/compare/types";
import { buildComparePageHref } from "@/lib/compare/urls";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { workCardCtaBaseClassName } from "@/components/works/work-card-cta-styles";

type SimilarWorkSelectCardProps = {
  work: SimilarWorkCardData;
  anchorContentId: string;
  reasonLimit?: number;
};

export function SimilarWorkSelectCard({
  work,
  anchorContentId,
  reasonLimit = 4,
}: SimilarWorkSelectCardProps) {
  const router = useRouter();
  const currentLabel =
    formatPriceYen(work.currentPrice) ?? work.price;
  const regularLabel =
    work.regularPrice != null &&
    work.currentPrice != null &&
    work.regularPrice > work.currentPrice
      ? formatPriceYen(work.regularPrice)
      : undefined;
  const reasons = work.reasons.slice(0, reasonLimit);

  function handleCompare() {
    if (work.contentId === anchorContentId) return;
    setCompareIds([anchorContentId, work.contentId]);
    trackCompareEvent(COMPARE_GA_EVENTS.candidateSelect, {
      content_id: work.contentId,
      anchor_id: anchorContentId,
      similarity: work.similarityScore,
    });
    trackCompareEvent(COMPARE_GA_EVENTS.comparePageReach, {
      content_id: work.contentId,
      count: 2,
      source: "select",
    });
    router.push(buildComparePageHref([anchorContentId, work.contentId]));
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
      <Link href={`/works/${work.contentId}`} prefetch className="block">
        {work.imageUrl ? (
          <CatalogWorkImage
            src={work.imageUrl}
            alt={work.title}
            variant="portrait"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center bg-surface text-sm text-muted">
            画像なし
          </div>
        )}
        <div className="px-3 pt-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground hover:text-accent">
            {work.title}
          </h3>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
        <CompactNameList names={work.actressNames} />
        {(work.makerName || work.labelName) && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {work.labelName || work.makerName}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          {currentLabel ? (
            <span className="text-sm font-bold text-price">{currentLabel}</span>
          ) : null}
          {regularLabel ? (
            <span className="text-xs text-muted line-through">{regularLabel}</span>
          ) : null}
          {work.discountRate != null && work.discountRate > 0 ? (
            <span className="text-xs font-bold text-accent">
              {work.discountRate}%OFF
            </span>
          ) : null}
        </div>

        {work.priceDiffYen != null ? (
          <p className="mt-0.5 text-[11px] text-muted">
            比較元との価格差 {work.priceDiffYen.toLocaleString("ja-JP")}円
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
          {work.rating ? <span>評価 {work.rating}</span> : null}
          {work.releaseDate ? <span>{work.releaseDate}</span> : null}
        </div>

        <div className="mt-2 rounded-md bg-[#FFF7F7] px-2.5 py-2">
          <p className="text-xs font-bold text-accent">
            類似度 {work.similarityScore}%
          </p>
          {reasons.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-foreground/80">
              {reasons.map((reason) => (
                <li key={reason.key}>・{reason.label}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-auto space-y-2 pt-3">
          <button
            type="button"
            onClick={handleCompare}
            className={`${workCardCtaBaseClassName} border border-accent bg-accent text-white hover:bg-accent-hover`}
          >
            この作品と比較する
          </button>
          {work.fanzaUrl ? (
            <a
              href={work.fanzaUrl}
              target="_blank"
              rel={AFFILIATE_LINK_REL}
              onClick={() =>
                trackCompareEvent(COMPARE_GA_EVENTS.fanzaClick, {
                  content_id: work.contentId,
                  source: "select_card",
                })
              }
              className={`${workCardCtaBaseClassName} border border-border bg-white text-foreground hover:border-accent hover:text-accent`}
            >
              作品を見る
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
