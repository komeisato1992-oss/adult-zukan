"use client";

import { useEffect } from "react";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import { readDoujinCompareIds } from "@/lib/doujin/compare-store";

/** 同人比較ページ到達を1回計測 */
export function DoujinComparePageReachTracker({
  idsFromUrl,
}: {
  idsFromUrl: string[];
}) {
  useEffect(() => {
    const ids =
      idsFromUrl.length > 0
        ? idsFromUrl
        : readDoujinCompareIds().slice(0, 4);
    if (ids.length === 0) return;
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.comparePageReach, {
      count: ids.length,
      source: "page",
      ids: ids.join(","),
    });
  }, [idsFromUrl]);

  return null;
}
