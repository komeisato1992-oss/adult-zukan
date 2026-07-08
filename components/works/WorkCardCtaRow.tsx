"use client";

import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type WorkCardCtaRowProps = {
  contentId: string;
  fanzaUrl: string;
  className?: string;
};

export function WorkCardCtaRow({
  contentId,
  fanzaUrl,
  className = "",
}: WorkCardCtaRowProps) {
  return (
    <div className={`flex flex-nowrap gap-2 ${className}`}>
      <div className="min-w-0 flex-1 basis-0">
        <CompareToggleButton contentId={contentId} variant="card" />
      </div>
      {fanzaUrl ? (
        <a
          href={fanzaUrl}
          target="_blank"
          rel={AFFILIATE_LINK_REL}
          className={`${workCardCtaBaseClassName} shrink-0 flex-1 basis-0 bg-[#E60012] text-white transition-colors hover:bg-[#c4000f]`}
        >
          {WORK_CARD_VIEW_LABEL}
        </a>
      ) : null}
    </div>
  );
}
