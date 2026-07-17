"use client";

import { memo } from "react";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type WorkCardCtaRowProps = {
  contentId: string;
  fanzaUrl: string;
  title?: string;
  className?: string;
  /** トップ横スクロール向けにモバイルCTAを低くする */
  compact?: boolean;
};

function WorkCardCtaRowInner({
  contentId,
  fanzaUrl,
  title,
  className = "",
  compact = false,
}: WorkCardCtaRowProps) {
  const ctaClassName = compact
    ? `${workCardCtaBaseClassName} max-[768px]:h-8 max-[768px]:min-h-[32px] max-[768px]:text-[10px]`
    : workCardCtaBaseClassName;

  return (
    <div
      className={`flex flex-nowrap items-stretch gap-1.5 sm:gap-2 max-[768px]:flex-col max-[768px]:gap-1 ${className}`}
    >
      {fanzaUrl ? (
        <a
          href={fanzaUrl}
          target="_blank"
          rel={AFFILIATE_LINK_REL}
          className={`${ctaClassName} min-w-0 basis-[60%] bg-[#E60012] text-white transition-colors hover:bg-[#c4000f] md:flex-1 md:basis-0 max-[768px]:order-1 max-[768px]:basis-auto`}
        >
          {WORK_CARD_VIEW_LABEL}
        </a>
      ) : null}
      <div className="min-w-0 basis-[40%] md:flex-1 md:basis-0 max-[768px]:order-2 max-[768px]:basis-auto">
        <CompareToggleButton
          contentId={contentId}
          title={title}
          variant="card"
          disableAutoNavigate
          className={
            compact
              ? "max-[768px]:h-8 max-[768px]:min-h-[32px] max-[768px]:text-[10px]"
              : undefined
          }
        />
      </div>
    </div>
  );
}

export const WorkCardCtaRow = memo(
  WorkCardCtaRowInner,
  (prev, next) =>
    prev.contentId === next.contentId &&
    prev.fanzaUrl === next.fanzaUrl &&
    prev.title === next.title &&
    prev.className === next.className &&
    prev.compact === next.compact,
);
