"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addCompareId,
  COMPARE_MAX_ITEMS,
  isCompareId,
  readCompareIds,
  subscribeCompareStore,
} from "@/components/compare/compare-store";
import { CompactNameList } from "@/components/ui/CompactNameList";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import type { BothSimilarWorkCard } from "@/lib/compare/types";
import { buildComparePageHref } from "@/lib/compare/urls";

type CompareRelatedWorkCardProps = {
  work: BothSimilarWorkCard;
  source: "both" | "a" | "b";
};

export function CompareRelatedWorkCard({
  work,
  source,
}: CompareRelatedWorkCardProps) {
  const router = useRouter();
  const [inCompare, setInCompare] = useState(() => isCompareId(work.contentId));
  const [count, setCount] = useState(() => readCompareIds().length);

  useEffect(() => {
    const sync = () => {
      setInCompare(isCompareId(work.contentId));
      setCount(readCompareIds().length);
    };
    sync();
    return subscribeCompareStore(sync);
  }, [work.contentId]);

  const atLimit = count >= COMPARE_MAX_ITEMS && !inCompare;
  const disabled = inCompare || atLimit;
  const label = inCompare ? "比較中" : atLimit ? "比較上限" : "比較＋";
  const reasons = work.reasons.slice(0, 2);

  function handleAdd() {
    if (disabled) return;

    const result = addCompareId(work.contentId);
    trackCompareEvent(COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: work.contentId,
      action: "add",
      count: result.ids.length,
      source: "compare_related",
      related_source: source,
      similarity: work.similarityScore,
    });

    if (!result.added) return;

    router.push(buildComparePageHref(result.ids));
  }

  return (
    <article className="group flex h-full min-w-0 flex-row gap-3 overflow-hidden rounded-lg border border-border/80 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md max-[768px]:items-stretch min-[769px]:flex-col min-[769px]:gap-0 min-[769px]:p-0">
      <Link
        href={`/works/${work.contentId}`}
        prefetch
        className="shrink-0 max-[768px]:w-[35%] min-[769px]:block min-[769px]:w-full"
        onClick={() =>
          trackCompareEvent(COMPARE_GA_EVENTS.relatedClick, {
            content_id: work.contentId,
            source,
            similarity: work.similarityScore,
          })
        }
      >
        {work.imageUrl ? (
          <div className="flex items-center justify-center overflow-hidden rounded bg-surface max-[768px]:h-[160px] max-[768px]:w-full min-[769px]:h-[180px] min-[769px]:rounded-none">
            <Image
              src={work.imageUrl}
              alt={work.title}
              width={220}
              height={180}
              className="h-auto max-h-[160px] w-auto max-w-full object-contain min-[769px]:max-h-[180px]"
              sizes="(max-width: 768px) 35vw, (max-width: 1099px) 33vw, (max-width: 1399px) 25vw, 20vw"
              loading="lazy"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex h-[160px] items-center justify-center rounded bg-surface text-xs text-muted min-[769px]:h-[180px] min-[769px]:rounded-none">
            画像なし
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col max-[768px]:w-[65%] min-[769px]:px-2.5 min-[769px]:pb-2.5 min-[769px]:pt-2.5">
        <Link href={`/works/${work.contentId}`} prefetch className="min-w-0">
          <p className="line-clamp-2 min-h-0 text-sm font-semibold leading-snug text-foreground group-hover:text-accent min-[769px]:min-h-[2.5rem]">
            {work.title}
          </p>
        </Link>
        <div className="mt-1 line-clamp-2 text-xs">
          <CompactNameList names={work.actressNames} />
        </div>
        {work.price ? (
          <p className="mt-1 text-sm font-bold text-price">{work.price}</p>
        ) : null}
        <div className="mt-1 rounded-md bg-[#FFF7F7] px-2 py-1.5 max-[768px]:bg-transparent max-[768px]:px-0 max-[768px]:py-0">
          <p className="text-[11px] font-bold text-accent max-[768px]:font-normal max-[768px]:text-muted">
            類似度 {work.similarityScore}%
          </p>
          {reasons.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5 text-[11px] leading-snug text-foreground/80 max-[768px]:hidden">
              {reasons.map((reason) => (
                <li key={reason.key}>・{reason.label}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2.5 max-[768px]:gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            aria-disabled={disabled}
            className={`${workCardCtaBaseClassName} min-h-10 border max-[768px]:min-h-11 ${
              disabled
                ? "cursor-not-allowed border-border bg-[#FFF2F2] text-accent opacity-80"
                : "border-accent bg-white text-accent hover:bg-accent-light"
            }`}
          >
            {label}
          </button>
          <Link
            href={`/works/${work.contentId}`}
            className={`${workCardCtaBaseClassName} min-h-10 bg-accent text-white hover:bg-accent-hover max-[768px]:min-h-11`}
          >
            {WORK_CARD_VIEW_LABEL}
          </Link>
        </div>
      </div>
    </article>
  );
}
