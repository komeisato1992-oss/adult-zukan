"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  COMPARE_LIMIT_EVENT,
  COMPARE_MAX_ITEMS,
  clearCompareIds,
  readCompareIds,
  setCompareIds,
  subscribeCompareStore,
} from "@/components/compare/compare-store";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import { buildComparePageHref } from "@/lib/compare/urls";

type LoadState = "idle" | "loading" | "error";

function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

export function CompareMobileFooterBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const noticeTimerRef = useRef<number | null>(null);
  const shownTrackedRef = useRef(false);
  const isCompareRoot = pathname === "/compare";
  const isSelectPage = pathname.startsWith("/compare/select");
  const count = ids.length;
  const compareHref = buildComparePageHref(ids);
  const showGoCompare = count > 0 && (!isCompareRoot || isSelectPage);

  useEffect(() => {
    const sync = () => setIds(readCompareIds().slice(0, COMPARE_MAX_ITEMS));
    sync();
    return subscribeCompareStore(sync);
  }, []);

  useEffect(() => {
    if (shownTrackedRef.current) return;
    shownTrackedRef.current = true;
    trackCompareEvent(COMPARE_GA_EVENTS.floatingPanelShow, {
      page_path: pathname,
      compare_count: readCompareIds().length,
      device_type: getDeviceType(),
    });
  }, [pathname]);

  useEffect(() => {
    const onLimit = () => {
      setNotice("比較できるのは最大4作品です");
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      noticeTimerRef.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimerRef.current = null;
      }, 2500);
    };
    window.addEventListener(COMPARE_LIMIT_EVENT, onLimit);
    return () => {
      window.removeEventListener(COMPARE_LIMIT_EVENT, onLimit);
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function handleClear() {
    if (!window.confirm("比較リストをすべてクリアしますか？")) return;
    trackCompareEvent(COMPARE_GA_EVENTS.floatingClearClick, {
      page_path: pathname,
      compare_count: count,
      device_type: getDeviceType(),
    });
    clearCompareIds();
    setLoadState("idle");
  }

  async function handleSeeFeature() {
    if (loadState === "loading") return;

    trackCompareEvent(COMPARE_GA_EVENTS.floatingSeeFeatureClick, {
      page_path: pathname,
      compare_count: 0,
      device_type: getDeviceType(),
    });

    setLoadState("loading");
    try {
      const response = await fetch("/api/compare/random-pair", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("pair_failed");
      }
      const json = (await response.json()) as {
        seedWorkId?: string;
        matchedWorkId?: string;
        similarityScore?: number;
      };
      if (!json.seedWorkId || !json.matchedWorkId) {
        throw new Error("pair_invalid");
      }

      const pairIds = [json.seedWorkId, json.matchedWorkId];
      setCompareIds(pairIds);
      trackCompareEvent(COMPARE_GA_EVENTS.floatingRandomPairSuccess, {
        page_path: pathname,
        compare_count: 2,
        seed_work_id: json.seedWorkId,
        matched_work_id: json.matchedWorkId,
        similarity_score: json.similarityScore ?? 0,
        device_type: getDeviceType(),
      });
      setLoadState("idle");
      router.push(buildComparePageHref(pairIds));
    } catch {
      trackCompareEvent(COMPARE_GA_EVENTS.floatingRandomPairFail, {
        page_path: pathname,
        compare_count: 0,
        device_type: getDeviceType(),
      });
      setLoadState("error");
    }
  }

  return (
    <div className="relative border-b border-border" data-compare-mobile-footer-bar>
      {notice ? (
        <p
          role="status"
          className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-accent/20 bg-accent-light px-2.5 py-1.5 text-center text-xs text-accent shadow-sm"
        >
          {notice}
        </p>
      ) : null}

      {count === 0 ? (
        <div className="flex h-[42px] min-h-[42px] items-stretch">
          <div className="flex flex-1 items-center justify-center border-r border-border/80 bg-gray-50 px-2 text-[13px] font-bold text-gray-700">
            作品比較
          </div>
          <button
            type="button"
            onClick={() => void handleSeeFeature()}
            disabled={loadState === "loading"}
            className="flex flex-1 items-center justify-center gap-1 bg-accent px-2 text-[13px] font-bold text-white hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
          >
            {loadState === "loading"
              ? "選んでいます…"
              : loadState === "error"
                ? "再試行する"
                : "比較機能を見る"}
            <span aria-hidden>→</span>
          </button>
        </div>
      ) : (
        <div className="flex h-[42px] min-h-[42px] items-stretch">
          <div className="flex flex-1 items-center justify-center border-r border-border/80 bg-gray-50 px-2 text-[13px] font-bold text-gray-700">
            比較中 {count} / {COMPARE_MAX_ITEMS}
          </div>
          {showGoCompare ? (
            <Link
              href={compareHref}
              onClick={() =>
                trackCompareEvent(COMPARE_GA_EVENTS.floatingGoCompareClick, {
                  page_path: pathname,
                  compare_count: count,
                  device_type: "mobile",
                })
              }
              className="flex flex-1 items-center justify-center gap-1 bg-accent px-2 text-[13px] font-bold text-white hover:bg-accent-hover"
            >
              比較ページへ
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="flex flex-1 items-center justify-center gap-1 bg-white px-2 text-[13px] font-bold text-accent hover:bg-accent-light"
            >
              比較をクリア
            </button>
          )}
        </div>
      )}

      {count === 0 && loadState === "error" ? (
        <p className="absolute bottom-full left-0 right-0 mb-0.5 text-center text-[11px] text-muted">
          比較作品を取得できませんでした
        </p>
      ) : null}
    </div>
  );
}
