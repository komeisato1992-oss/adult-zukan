"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoujinCardImage } from "@/components/doujin/DoujinCardImage";
import { workCardCtaBaseClassName } from "@/components/works/work-card-cta-styles";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import type { DoujinSimilarWorkCardData } from "@/lib/doujin/compare/types";
import { formatDoujinComparePriceYen } from "@/lib/doujin/compare/types";
import { buildDoujinComparePageHref } from "@/lib/doujin/compare/urls";
import { setDoujinCompareIds } from "@/lib/doujin/compare-store";

type DoujinSimilarWorkSelectCardProps = {
  work: DoujinSimilarWorkCardData;
  anchorWorkId: string;
  reasonLimit?: number;
};

export function DoujinSimilarWorkSelectCard({
  work,
  anchorWorkId,
  reasonLimit = 4,
}: DoujinSimilarWorkSelectCardProps) {
  const router = useRouter();
  const reasons = work.reasonLabels.slice(0, reasonLimit);
  const priceLabel = formatDoujinComparePriceYen(work.price);

  function handleCompare() {
    if (work.workId === anchorWorkId) return;
    setDoujinCompareIds([anchorWorkId, work.workId]);
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.candidateSelect, {
      content_id: work.workId,
      anchor_id: anchorWorkId,
      similarity: work.similarityScore,
    });
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.comparePageReach, {
      content_id: work.workId,
      count: 2,
      source: "select",
    });
    router.push(buildDoujinComparePageHref([anchorWorkId, work.workId]));
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
      <Link href={`/doujin/works/${work.workId}`} prefetch className="block">
        <div className="doujin-work-card__image-wrapper relative mx-auto w-full overflow-hidden">
          {work.imageUrl ? (
            <DoujinCardImage
              src={work.imageUrl}
              alt={work.title}
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center bg-surface text-sm text-muted">
              画像なし
            </div>
          )}
        </div>
        <div className="px-3 pt-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground hover:text-accent">
            {work.title}
          </h3>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-1">
        {work.circleName ? (
          <p className="line-clamp-1 text-xs text-muted">{work.circleName}</p>
        ) : null}
        {work.authorNames.length > 0 ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
            {work.authorNames.slice(0, 3).join("、")}
          </p>
        ) : null}
        {work.productFormat ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
            {work.productFormat}
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          {work.price != null ? (
            <span className="text-sm font-bold text-price">{priceLabel}</span>
          ) : null}
        </div>

        <div className="mt-2 rounded-md bg-accent-light px-2.5 py-2">
          <p className="text-xs font-bold text-accent">
            類似度 {work.similarityScore}%
          </p>
          {reasons.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-foreground/80">
              {reasons.map((reason) => (
                <li key={reason}>・{reason}</li>
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
          <Link
            href={`/doujin/works/${work.workId}`}
            onClick={() =>
              trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.fanzaClick, {
                content_id: work.workId,
                source: "select_card",
              })
            }
            className={`${workCardCtaBaseClassName} border border-border bg-white text-foreground hover:border-accent hover:text-accent`}
          >
            作品を見る
          </Link>
        </div>
      </div>
    </article>
  );
}
