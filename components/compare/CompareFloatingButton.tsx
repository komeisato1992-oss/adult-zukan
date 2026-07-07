"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  COMPARE_LIMIT_EVENT,
  clearCompareIds,
  readCompareIds,
  subscribeCompareStore,
} from "@/components/compare/compare-store";

export function CompareFloatingButton() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const isComparePage = pathname === "/compare";

  useEffect(() => {
    const sync = () => setCount(readCompareIds().length);
    sync();
    return subscribeCompareStore(sync);
  }, []);

  useEffect(() => {
    const onLimit = () => {
      setNotice("比較は3作品までです");
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
    clearCompareIds();
  }

  if (count <= 0) return null;

  return (
    <div className="fixed bottom-5 right-4 z-40 w-[200px] sm:right-6">
      {notice ? (
        <p
          role="status"
          className="mb-2 rounded-lg border border-accent/20 bg-accent-light px-2.5 py-1.5 text-center text-xs text-accent shadow-sm"
        >
          {notice}
        </p>
      ) : null}
      <aside
        className="overflow-hidden rounded-lg border border-border bg-white shadow-md"
        aria-label="作品比較"
      >
        <div className="border-b border-border bg-gray-50 px-3 py-2.5 text-center text-sm font-bold text-gray-900">
          作品比較（{count}作品目）
        </div>
        <div className="space-y-2 p-3">
          {!isComparePage ? (
            <Link
              href="/compare"
              className="flex items-center justify-center gap-1 rounded-md bg-accent px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              比較ページへ
              <span aria-hidden>→</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleClear}
            className="w-full px-1 py-1.5 text-center text-sm text-accent transition-colors hover:text-accent-hover"
          >
            比較をクリア
          </button>
        </div>
      </aside>
    </div>
  );
}
