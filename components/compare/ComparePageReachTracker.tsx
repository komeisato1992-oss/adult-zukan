"use client";

import { useEffect } from "react";
import { readCompareIds } from "@/components/compare/compare-store";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";

/** 比較ページ到達を1回計測 */
export function ComparePageReachTracker({
  idsFromUrl,
}: {
  idsFromUrl: string[];
}) {
  useEffect(() => {
    const ids =
      idsFromUrl.length > 0 ? idsFromUrl : readCompareIds().slice(0, 4);
    if (ids.length === 0) return;
    trackCompareEvent(COMPARE_GA_EVENTS.comparePageReach, {
      count: ids.length,
      source: "page",
      ids: ids.join(","),
    });
  }, [idsFromUrl]);

  return null;
}
