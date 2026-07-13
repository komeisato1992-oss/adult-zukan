"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import { buildDoujinComparePageHref } from "@/lib/doujin/compare/urls";
import {
  DOUJIN_COMPARE_LIMIT_EVENT,
  DOUJIN_COMPARE_MAX_ITEMS,
  clearDoujinCompareIds,
  readDoujinCompareIds,
  setDoujinCompareIds,
  subscribeDoujinCompareStore,
} from "@/lib/doujin/compare-store";

type LoadState = "idle" | "loading" | "error";

function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

export function DoujinCompareFloatingButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const noticeTimerRef = useRef<number | null>(null);
  const shownTrackedRef = useRef(false);
  const isCompareRoot = pathname === "/doujin/compare";
  const isSelectPage = pathname.startsWith("/doujin/compare/select");
  const count = ids.length;
  const compareHref = buildDoujinComparePageHref(ids);
  const showGoCompare = count > 0 && (!isCompareRoot || isSelectPage);

  useEffect(() => {
    const sync = () =>
      setIds(readDoujinCompareIds().slice(0, DOUJIN_COMPARE_MAX_ITEMS));
    sync();
    return subscribeDoujinCompareStore(sync);
  }, []);

  useEffect(() => {
    if (shownTrackedRef.current) return;
    shownTrackedRef.current = true;
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.floatingPanelShow, {
      page_path: pathname,
      compare_count: readDoujinCompareIds().length,
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
    window.addEventListener(DOUJIN_COMPARE_LIMIT_EVENT, onLimit);
    return () => {
      window.removeEventListener(DOUJIN_COMPARE_LIMIT_EVENT, onLimit);
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function handleClear() {
    if (!window.confirm("比較リストをすべてクリアしますか？")) return;
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.floatingClearClick, {
      page_path: pathname,
      compare_count: count,
      device_type: getDeviceType(),
    });
    clearDoujinCompareIds();
    setLoadState("idle");
  }

  async function handleSeeFeature() {
    if (loadState === "loading") return;

    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.floatingSeeFeatureClick, {
      page_path: pathname,
      compare_count: 0,
      device_type: getDeviceType(),
    });

    setLoadState("loading");
    try {
      const response = await fetch("/api/doujin/compare/random-pair", {
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
      setDoujinCompareIds(pairIds);
      trackDoujinCompareEvent(
        DOUJIN_COMPARE_GA_EVENTS.floatingRandomPairSuccess,
        {
          page_path: pathname,
          compare_count: 2,
          seed_work_id: json.seedWorkId,
          matched_work_id: json.matchedWorkId,
          similarity_score: json.similarityScore ?? 0,
          device_type: getDeviceType(),
        },
      );
      setLoadState("idle");
      router.push(buildDoujinComparePageHref(pairIds));
    } catch {
      trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.floatingRandomPairFail, {
        page_path: pathname,
        compare_count: 0,
        device_type: getDeviceType(),
      });
      setLoadState("error");
    }
  }

  const heading =
    count === 0
      ? "作品比較"
      : `作品比較（${count} / ${DOUJIN_COMPARE_MAX_ITEMS}作品）`;

  return (
    <div
      className="pointer-events-none fixed z-40 max-[768px]:bottom-[calc(56px+env(safe-area-inset-bottom)+8px)] max-[768px]:left-1/2 max-[768px]:w-[min(96vw,420px)] max-[768px]:-translate-x-1/2 min-[769px]:bottom-[max(1.25rem,env(safe-area-inset-bottom))] min-[769px]:right-4 min-[769px]:w-[min(calc(100vw-2rem),360px)] sm:min-[769px]:right-6"
      data-doujin-compare-floating-panel
    >
      {notice ? (
        <p
          role="status"
          className="pointer-events-auto mb-2 rounded-lg border border-accent/20 bg-accent-light px-2.5 py-1.5 text-center text-xs text-accent shadow-sm"
        >
          {notice}
        </p>
      ) : null}

      <div className="pointer-events-auto min-[769px]:hidden">
        {count === 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-md">
            <button
              type="button"
              onClick={() => void handleSeeFeature()}
              disabled={loadState === "loading"}
              className="flex min-h-[56px] w-full items-center justify-center gap-1 bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
            >
              {loadState === "loading"
                ? "似ている作品を選んでいます…"
                : loadState === "error"
                  ? "再試行する →"
                  : "比較機能を見る →"}
            </button>
            {loadState === "error" ? (
              <p className="px-3 py-2 text-center text-[11px] text-muted">
                比較作品を取得できませんでした
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[56px] max-h-16 items-stretch overflow-hidden rounded-xl border border-border bg-white shadow-md">
            <div className="flex flex-1 items-center justify-center bg-gray-50 px-3 text-xs font-bold text-gray-900">
              比較中 {count} / {DOUJIN_COMPARE_MAX_ITEMS}
            </div>
            {showGoCompare ? (
              <Link
                href={compareHref}
                onClick={() =>
                  trackDoujinCompareEvent(
                    DOUJIN_COMPARE_GA_EVENTS.floatingGoCompareClick,
                    {
                      page_path: pathname,
                      compare_count: count,
                      device_type: "mobile",
                    },
                  )
                }
                className="flex min-w-[44%] items-center justify-center bg-accent px-3 text-sm font-bold text-white hover:bg-accent-hover"
              >
                比較ページへ
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleClear}
                className="flex min-w-[44%] items-center justify-center px-3 text-sm font-bold text-accent hover:bg-accent-light"
              >
                比較をクリア
              </button>
            )}
          </div>
        )}
      </div>

      <aside
        className="pointer-events-auto hidden overflow-hidden rounded-xl border border-border bg-white shadow-md min-[769px]:block"
        aria-label="同人作品比較"
      >
        <div className="border-b border-border bg-gray-50 px-4 py-3 text-center text-sm font-bold text-gray-900">
          {heading}
        </div>
        <div className="space-y-3 p-4">
          {count === 0 ? (
            <>
              <p className="text-center text-sm text-muted">
                気になる同人作品を並べて比較できます
              </p>
              <button
                type="button"
                onClick={() => void handleSeeFeature()}
                disabled={loadState === "loading"}
                className="flex min-h-11 w-full items-center justify-center gap-1 rounded-md bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-80"
              >
                {loadState === "loading" ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden
                    />
                    似ている作品を選んでいます…
                  </>
                ) : loadState === "error" ? (
                  "再試行する →"
                ) : (
                  <>
                    比較機能を見る
                    <span aria-hidden>→</span>
                  </>
                )}
              </button>
              {loadState === "error" ? (
                <p className="text-center text-xs text-muted">
                  比較作品を取得できませんでした
                </p>
              ) : null}
            </>
          ) : (
            <>
              {showGoCompare ? (
                <Link
                  href={compareHref}
                  onClick={() =>
                    trackDoujinCompareEvent(
                      DOUJIN_COMPARE_GA_EVENTS.floatingGoCompareClick,
                      {
                        page_path: pathname,
                        compare_count: count,
                        device_type: "desktop",
                      },
                    )
                  }
                  className="flex min-h-11 w-full items-center justify-center gap-1 rounded-md bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
                >
                  比較ページへ
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
              {count === 1 ? (
                <Link
                  href={`/doujin/compare/select/${encodeURIComponent(ids[0])}`}
                  className="flex min-h-10 w-full items-center justify-center rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent hover:bg-accent-light"
                >
                  似ている作品を見る
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-1 py-1.5 text-center text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                比較をクリア
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
