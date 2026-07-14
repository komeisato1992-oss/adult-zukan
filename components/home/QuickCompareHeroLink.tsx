"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  COMPARE_ENTRY_SOURCE_KEY,
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import type { QuickCompareSelectionType } from "@/lib/compare/quick-compare-types";

type QuickCompareHeroLinkProps = {
  href: string;
  selectionType: QuickCompareSelectionType;
  workId1?: string;
  workId2?: string;
  className?: string;
  children: ReactNode;
};

/**
 * TOPヒーロー「比較機能を見る」。
 * 実URLを持つ Link のまま、クリック時のみ GA を送る（遷移は止めない）。
 */
export function QuickCompareHeroLink({
  href,
  selectionType,
  workId1,
  workId2,
  className,
  children,
}: QuickCompareHeroLinkProps) {
  return (
    <Link
      href={href}
      prefetch
      className={className}
      onClick={() => {
        try {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              COMPARE_ENTRY_SOURCE_KEY,
              "top_quick_compare",
            );
          }
        } catch {
          // sessionStorage 失敗時も遷移を優先
        }

        try {
          trackCompareEvent(COMPARE_GA_EVENTS.quickCompareClick, {
            placement: "top_hero",
            source: "adult_top",
            work_id_1: workId1,
            work_id_2: workId2,
            selection_type: selectionType,
            page_path: "/",
          });
        } catch {
          // GA 失敗時も遷移を止めない
        }
      }}
    >
      {children}
    </Link>
  );
}
