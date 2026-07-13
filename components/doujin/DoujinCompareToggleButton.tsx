"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openDoujinCompareCandidateGuide } from "@/components/doujin/DoujinCompareCandidateGuide";
import {
  WORK_CARD_COMPARE_ACTIVE_LABEL,
  WORK_CARD_COMPARE_LABEL,
  WORK_CARD_COMPARE_LABEL_MOBILE,
  doujinWorkCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import { buildDoujinComparePageHref } from "@/lib/doujin/compare/urls";
import {
  isDoujinCompareId,
  subscribeDoujinCompareStore,
  toggleDoujinCompareId,
} from "@/lib/doujin/compare-store";

type DoujinCompareToggleButtonProps = {
  workId: string;
  title?: string;
  className?: string;
  variant?: "default" | "card";
  disableAutoNavigate?: boolean;
};

function DoujinCompareToggleButtonInner({
  workId,
  title,
  className = "",
  variant = "default",
  disableAutoNavigate = false,
}: DoujinCompareToggleButtonProps) {
  const router = useRouter();
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
    const wasCompared = isDoujinCompareId(workId);
    const result = toggleDoujinCompareId(workId);

    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: workId,
      action: wasCompared ? "remove" : "add",
      count: result.ids.length,
    });

    if (result.error) {
      if (result.error !== "比較できるのは最大4作品です") {
        setMessage(result.error);
        window.setTimeout(() => setMessage(null), 2000);
      }
      return;
    }

    const next = result.ids.includes(workId);
    setIsCompared((current) => (current === next ? current : next));

    if (!result.added) return;

    if (result.ids.length === 1) {
      openDoujinCompareCandidateGuide({
        contentId: workId,
        title: title?.trim() || workId,
      });
      return;
    }

    if (result.ids.length >= 2 && !disableAutoNavigate) {
      trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.comparePageReach, {
        content_id: workId,
        count: result.ids.length,
        source: "toggle",
      });
      router.push(buildDoujinComparePageHref(result.ids));
    }
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

export const DoujinCompareToggleButton = memo(
  DoujinCompareToggleButtonInner,
  (prev, next) =>
    prev.workId === next.workId &&
    prev.title === next.title &&
    prev.className === next.className &&
    prev.variant === next.variant &&
    prev.disableAutoNavigate === next.disableAutoNavigate,
);
