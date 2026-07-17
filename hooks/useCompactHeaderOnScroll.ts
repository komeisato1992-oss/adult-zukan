"use client";

import { useEffect, useRef, useState } from "react";

/**
 * トップでコンパクトへ入る / 戻るスクロールしきい値（ヒステリシス）。
 * 同一閾値での往復切替を避ける。
 */
export const SCROLL_ENTER_COMPACT = 120;
export const SCROLL_EXIT_COMPACT = 60;

type UseCompactHeaderOnScrollOptions = {
  /** トップページのときだけスクロールで展開/コンパクト切替。それ以外は常にコンパクト */
  isHome: boolean;
  /** 検索展開・メニュー開閉中はスクロール切替をロック */
  lockCompactToggle: boolean;
};

/**
 * アダルト図鑑 / 同人図鑑共通のモバイルヘッダー用スクロール判定。
 * - トップ以外: 常に compact
 * - トップ: scrollY >= 120 で compact、<= 60 で展開へ復帰（60〜119 は現状維持）
 * - 判定は固定 scrollY のみ（ヒーロー位置の毎フレーム計測なし）
 * - scroll は rAF 間引き + passive
 * - 状態が変わったときだけ setState
 */
export function useCompactHeaderOnScroll({
  isHome,
  lockCompactToggle,
}: UseCompactHeaderOnScrollOptions) {
  const [isCompact, setIsCompact] = useState(() => !isHome);
  const compactRef = useRef(!isHome);
  const lockRef = useRef(lockCompactToggle);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    lockRef.current = lockCompactToggle;
  }, [lockCompactToggle]);

  useEffect(() => {
    if (!isHome) {
      compactRef.current = true;
      setIsCompact(true);
      return;
    }

    const applyCompact = (next: boolean) => {
      if (next === compactRef.current) return;
      compactRef.current = next;
      setIsCompact(next);
    };

    const readScroll = () => {
      rafRef.current = null;
      if (lockRef.current) return;
      const y = window.scrollY;
      if (compactRef.current) {
        if (y <= SCROLL_EXIT_COMPACT) applyCompact(false);
      } else if (y >= SCROLL_ENTER_COMPACT) {
        applyCompact(true);
      }
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(readScroll);
    };

    const initialY = window.scrollY;
    const initialCompact = initialY >= SCROLL_ENTER_COMPACT;
    compactRef.current = initialCompact;
    setIsCompact(initialCompact);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isHome]);

  return { isCompact, setIsCompact };
}
