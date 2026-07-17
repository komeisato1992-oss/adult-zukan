"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addCompareId,
  COMPARE_MAX_ITEMS,
  isCompareId,
  readCompareIds,
  subscribeCompareStore,
} from "@/components/compare/compare-store";
import { RandomCompareCard } from "@/components/home/RandomCompareCard";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import type { SimilarWorkCardData } from "@/lib/compare/types";
import { buildComparePageHref } from "@/lib/compare/urls";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

const CAROUSEL_SCROLL_KEY = "az_compare_similar_scroll_x";

type CompareSimilarWorksCarouselProps = {
  works: SimilarWorkCardData[];
  /** サーバー側で渡す比較中ID（初期除外用） */
  excludeIds?: string[];
  source?: "both" | "a" | "b" | "single";
  worksHref?: string;
  worksLabel?: string;
};

function CandidateCard({
  work,
  source,
}: {
  work: SimilarWorkCardData;
  source: CompareSimilarWorksCarouselProps["source"];
}) {
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
  const label = inCompare ? "比較中" : atLimit ? "比較上限" : "比較";

  function handleAdd() {
    if (disabled) return;

    const scrollY = window.scrollY;
    const result = addCompareId(work.contentId);
    trackCompareEvent(COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: work.contentId,
      action: "add",
      count: result.ids.length,
      source: "compare_related",
      related_source: source ?? "single",
      similarity: work.similarityScore,
    });

    if (!result.added) return;

    router.replace(buildComparePageHref(result.ids), { scroll: false });
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }

  return (
    <RandomCompareCard
      layout="stacked"
      className="min-w-[260px] max-w-[300px] flex-[0_0_auto] w-[min(300px,78vw)]"
      item={{
        contentId: work.contentId,
        title: work.title,
        imageUrl: work.imageUrl,
        price: work.price,
        actressNames: work.actressNames,
        duration: work.duration,
      }}
    >
      <div className="grid grid-cols-2 gap-1.5 px-0.5 pb-0.5">
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          aria-disabled={disabled}
          className={`${workCardCtaBaseClassName} min-h-10 border ${
            disabled
              ? "cursor-not-allowed border-border bg-[#FFF2F2] text-accent opacity-80"
              : "border-accent bg-white text-accent hover:bg-accent-light"
          }`}
        >
          {label}
        </button>
        {work.fanzaUrl ? (
          <a
            href={work.fanzaUrl}
            target="_blank"
            rel={AFFILIATE_LINK_REL}
            onClick={() =>
              trackCompareEvent(COMPARE_GA_EVENTS.fanzaClick, {
                content_id: work.contentId,
                source: "compare_related",
              })
            }
            className={`${workCardCtaBaseClassName} min-h-10 bg-accent text-white hover:bg-accent-hover`}
          >
            {WORK_CARD_VIEW_LABEL}
          </a>
        ) : (
          <span
            className={`${workCardCtaBaseClassName} min-h-10 cursor-not-allowed border border-border bg-surface text-muted`}
          >
            {WORK_CARD_VIEW_LABEL}
          </span>
        )}
      </div>
    </RandomCompareCard>
  );
}

export function CompareSimilarWorksCarousel({
  works,
  excludeIds = [],
  source = "single",
  worksHref = "/works",
  worksLabel = "作品一覧から探す",
}: CompareSimilarWorksCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const excludeKey = excludeIds.join(",");
  const [compareIds, setCompareIdsState] = useState<string[]>(() => [
    ...new Set([...excludeIds, ...readCompareIds()]),
  ]);

  useEffect(() => {
    const sync = () => {
      setCompareIdsState([...new Set([...excludeIds, ...readCompareIds()])]);
    };
    sync();
    return subscribeCompareStore(sync);
    // excludeKey tracks excludeIds contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = window.sessionStorage.getItem(CAROUSEL_SCROLL_KEY);
      if (saved) {
        el.scrollLeft = Number(saved) || 0;
      }
    } catch {
      // ignore
    }

    const onScroll = () => {
      try {
        window.sessionStorage.setItem(
          CAROUSEL_SCROLL_KEY,
          String(el.scrollLeft),
        );
      } catch {
        // ignore
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const visibleWorks = useMemo(() => {
    const seen = new Set<string>();
    const exclude = new Set(compareIds);
    const result: SimilarWorkCardData[] = [];
    for (const work of works) {
      if (!work.contentId || exclude.has(work.contentId)) continue;
      if (seen.has(work.contentId)) continue;
      seen.add(work.contentId);
      result.push(work);
    }
    return result;
  }, [works, compareIds]);

  if (visibleWorks.length === 0) {
    return (
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
          似ている作品
        </h2>
        <p className="mt-2 text-sm text-muted">
          いま追加できる比較候補はありません
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href={worksHref} className="text-accent hover:underline">
            {worksLabel}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-border pt-8 max-[768px]:mt-8">
      <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
        似ている作品
      </h2>
      <p className="mt-2 text-sm text-muted">比較候補として追加できます</p>

      {visibleWorks.length >= 2 ? (
        <p className="mt-3 flex items-center gap-1 text-xs text-muted">
          <span aria-hidden>←</span>
          横にスワイプして比較候補を選べます
          <span aria-hidden>→</span>
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="-mx-4 mt-3 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max items-stretch gap-3 px-4 pr-6 min-[769px]:gap-4">
          {visibleWorks.map((work) => (
            <CandidateCard
              key={work.contentId}
              work={work}
              source={source}
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href={worksHref} className="text-accent hover:underline">
          {worksLabel}
        </Link>
      </p>
    </section>
  );
}
