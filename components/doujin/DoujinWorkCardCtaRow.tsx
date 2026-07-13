"use client";

import { memo } from "react";
import { DoujinCompareToggleButton } from "@/components/doujin/DoujinCompareToggleButton";
import { doujinWorkCardCtaBaseClassName } from "@/components/works/work-card-cta-styles";
import { isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

const WORK_VIEW_LABEL = "作品を見る";

type DoujinWorkCardCtaRowProps = {
  workId: string;
  affiliateUrl?: string;
  className?: string;
};

function DoujinWorkCardCtaRowInner({
  workId,
  affiliateUrl,
  className = "",
}: DoujinWorkCardCtaRowProps) {
  const validUrl = isValidDoujinAffiliateUrl(affiliateUrl);

  return (
    <div className={`flex flex-nowrap items-stretch gap-1.5 sm:gap-2 ${className}`}>
      <div className="min-w-0 basis-[40%]">
        <DoujinCompareToggleButton workId={workId} variant="card" />
      </div>
      {validUrl ? (
        <a
          href={affiliateUrl}
          target="_blank"
          rel={AFFILIATE_LINK_REL}
          className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] bg-accent text-white transition-colors hover:bg-accent-hover`}
        >
          {WORK_VIEW_LABEL}
        </a>
      ) : (
        <span
          className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] cursor-not-allowed border border-border bg-surface text-muted`}
          title="アフィリエイトURL準備中"
        >
          準備中
        </span>
      )}
    </div>
  );
}

export const DoujinWorkCardCtaRow = memo(
  DoujinWorkCardCtaRowInner,
  (prev, next) =>
    prev.workId === next.workId &&
    prev.affiliateUrl === next.affiliateUrl &&
    prev.className === next.className,
);
