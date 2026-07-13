"use client";

import { memo, useEffect, useState } from "react";
import {
  isDoujinCompareId,
  subscribeDoujinCompareStore,
  toggleDoujinCompareId,
} from "@/lib/doujin/compare-store";
import {
  WORK_CARD_COMPARE_ACTIVE_LABEL,
  doujinWorkCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";

type DoujinCompareToggleButtonProps = {
  workId: string;
  className?: string;
  variant?: "default" | "card";
};

function DoujinCompareToggleButtonInner({
  workId,
  className = "",
  variant = "default",
}: DoujinCompareToggleButtonProps) {
  const [isCompared, setIsCompared] = useState(() => isDoujinCompareId(workId));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = isDoujinCompareId(workId);
      setIsCompared((current) => (current === next ? current : next));
    };
    sync();
    return subscribeDoujinCompareStore(sync);
  }, [workId]);

  function handleClick() {
    const result = toggleDoujinCompareId(workId);
    if (result.error) {
      if (result.error !== "比較は3作品までです") {
        setMessage(result.error);
        window.setTimeout(() => setMessage(null), 2000);
      }
      return;
    }
    const next = result.ids.includes(workId);
    setIsCompared((current) => (current === next ? current : next));
  }

  const cardClassName =
    variant === "card"
      ? `${doujinWorkCardCtaBaseClassName} border transition-colors ${
          isCompared
            ? "border-accent bg-accent-light text-accent"
            : "border-accent bg-white text-accent hover:bg-accent-light"
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
            <span className="md:hidden">比較</span>
            <span className="hidden md:inline">比較に追加</span>
          </>
        ) : (
          "比較に追加"
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

export const DoujinCompareToggleButton = memo(
  DoujinCompareToggleButtonInner,
  (prev, next) =>
    prev.workId === next.workId &&
    prev.className === next.className &&
    prev.variant === next.variant,
);
