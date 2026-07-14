"use client";

import { useEffect, useRef, useState } from "react";

/** トップでコンパクトへ入る / 戻るスクロールしきい値（チャタリング防止） */
export const SCROLL_ENTER_COMPACT = 56;
export const SCROLL_EXIT_COMPACT = 20;

type UseCompactHeaderOnScrollOptions = {
  /** トップページのときだけスクロールで展開/コンパクト切替。それ以外は常にコンパクト */
  isHome: boolean;
  /** 検索展開・メニュー開閉中はスクロール切替をロック */
  lockCompactToggle: boolean;
};

/**
 * アダルト図鑑 / 同人図鑑共通のモバイルヘッダー用スクロール判定。
 * - トップ以外: 常に compact
 * - トップ: scrollY >= 56 で compact、<= 20 で展開へ復帰
 */
export function useCompactHeaderOnScroll({
  isHome,
  lockCompactToggle,
}: UseCompactHeaderOnScrollOptions) {
  const [isCompact, setIsCompact] = useState(() => !isHome);
  const compactRef = useRef(!isHome);
  const lockRef = useRef(lockCompactToggle);

  useEffect(() => {
    lockRef.current = lockCompactToggle;
  }, [lockCompactToggle]);

  useEffect(() => {
    if (!isHome) {
      compactRef.current = true;
      setIsCompact(true);
      return;
    }

    let ticking = false;

    const applyCompact = (next: boolean) => {
      if (next === compactRef.current) return;
      compactRef.current = next;
      setIsCompact(next);
    };

    const readScroll = () => {
      ticking = false;
      if (lockRef.current) return;
      const y = window.scrollY;
      if (compactRef.current) {
        if (y <= SCROLL_EXIT_COMPACT) applyCompact(false);
      } else if (y >= SCROLL_ENTER_COMPACT) {
        applyCompact(true);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(readScroll);
    };

    const initialY = window.scrollY;
    const initialCompact = initialY >= SCROLL_ENTER_COMPACT;
    compactRef.current = initialCompact;
    setIsCompact(initialCompact);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return { isCompact, setIsCompact };
}
