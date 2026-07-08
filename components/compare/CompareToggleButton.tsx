"use client";

import { memo, useEffect, useState } from "react";
import {
  isCompareId,
  subscribeCompareStore,
  toggleCompareId,
} from "@/components/compare/compare-store";
import {
  WORK_CARD_COMPARE_ACTIVE_LABEL,
  WORK_CARD_COMPARE_LABEL,
  WORK_CARD_COMPARE_LABEL_MOBILE,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";

type CompareToggleButtonProps = {
  contentId: string;
  className?: string;
  variant?: "default" | "card";
};

function CompareToggleButtonInner({
  contentId,
  className = "",
  variant = "default",
}: CompareToggleButtonProps) {
  const [isCompared, setIsCompared] = useState(() => isCompareId(contentId));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = isCompareId(contentId);
      setIsCompared((current) => (current === next ? current : next));
    };
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
    const next = result.ids.includes(contentId);
    setIsCompared((current) => (current === next ? current : next));
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
        {isCompared ? (
          WORK_CARD_COMPARE_ACTIVE_LABEL
        ) : variant === "card" ? (
          <>
            <span className="md:hidden">{WORK_CARD_COMPARE_LABEL_MOBILE}</span>
            <span className="hidden md:inline">{WORK_CARD_COMPARE_LABEL}</span>
          </>
        ) : (
          WORK_CARD_COMPARE_LABEL
        )}

      </button>
      {message ? (
        <p className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[11px] text-white">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export const CompareToggleButton = memo(
  CompareToggleButtonInner,
  (prev, next) =>
    prev.contentId === next.contentId &&
    prev.className === next.className &&
    prev.variant === next.variant,
);
