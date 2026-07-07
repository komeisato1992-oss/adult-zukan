"use client";

import { useEffect, useState } from "react";
import {
  readCompareIds,
  subscribeCompareStore,
  toggleCompareId,
} from "@/components/compare/compare-store";

type CompareToggleButtonProps = {
  contentId: string;
  className?: string;
};

export function CompareToggleButton({
  contentId,
  className = "",
}: CompareToggleButtonProps) {
  const [isCompared, setIsCompared] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setIsCompared(readCompareIds().includes(contentId));
    sync();
    return subscribeCompareStore(sync);
  }, [contentId]);

  function handleClick() {
    const result = toggleCompareId(contentId);
    if (result.error) {
      if (result.error !== "比較は3作品までです") {
        setMessage(result.error);
        window.setTimeout(() => setMessage(null), 2000);
      }
      return;
    }
    setIsCompared(result.ids.includes(contentId));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center rounded border px-2.5 py-1.5 text-xs transition-colors ${
          isCompared
            ? "border-accent bg-accent-light text-accent"
            : "border-border text-muted hover:border-accent hover:text-accent"
        } ${className}`}
      >
        {isCompared ? "✓ 比較中" : "＋ 比較に追加"}
      </button>
      {message ? (
        <p className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-white">
          {message}
        </p>
      ) : null}
    </div>
  );
}
