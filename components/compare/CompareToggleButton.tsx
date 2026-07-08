"use client";

import { useEffect, useState } from "react";
import {
  readCompareIds,
  subscribeCompareStore,
  toggleCompareId,
} from "@/components/compare/compare-store";
import {
  WORK_CARD_COMPARE_ACTIVE_LABEL,
  WORK_CARD_COMPARE_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";

type CompareToggleButtonProps = {
  contentId: string;
  className?: string;
  variant?: "default" | "card";
};

export function CompareToggleButton({
  contentId,
  className = "",
  variant = "default",
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

  const cardClassName =
    variant === "card"
      ? `${workCardCtaBaseClassName} border transition-colors ${
          isCompared
            ? "border-[#E60012] bg-[#FFF2F2] text-[#E60012]"
            : "border-[#E60012] bg-white text-[#E60012] hover:bg-[#FFF2F2]"
        } ${className}`
      : "";

  const defaultClassName =
    variant === "default"
      ? `inline-flex items-center rounded border px-2.5 py-1.5 text-xs transition-colors ${
          isCompared
            ? "border-accent bg-accent-light text-accent"
            : "border-border text-muted hover:border-accent hover:text-accent"
        } ${className}`
      : "";

  return (
    <div className={variant === "card" ? "relative w-full" : "relative"}>
      <button
        type="button"
        onClick={handleClick}
        className={variant === "card" ? cardClassName : defaultClassName}
      >
        {isCompared ? WORK_CARD_COMPARE_ACTIVE_LABEL : WORK_CARD_COMPARE_LABEL}
      </button>
      {message ? (
        <p className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-white">
          {message}
        </p>
      ) : null}
    </div>
  );
}
