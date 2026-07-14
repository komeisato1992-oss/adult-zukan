"use client";

import { memo } from "react";
import { DoujinCompareToggleButton } from "@/components/doujin/DoujinCompareToggleButton";
import {
  WORK_CARD_VIEW_LABEL,
  doujinWorkCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import { isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type DoujinWorkCardCtaRowProps = {
  workId: string;
  title?: string;
  affiliateUrl?: string;
  className?: string;
};

function DoujinWorkCardCtaRowInner({
  workId,
  title,
  affiliateUrl,
  className = "",
}: DoujinWorkCardCtaRowProps) {
  const validUrl = isValidDoujinAffiliateUrl(affiliateUrl);

  return (
    <div
      className={`flex flex-nowrap items-stretch gap-1.5 sm:gap-2 max-[768px]:flex-col max-[768px]:gap-1 ${className}`}
    >
      {validUrl ? (
        <a
          href={affiliateUrl}
          target="_blank"
          rel={AFFILIATE_LINK_REL}
          className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] bg-accent text-white transition-colors hover:bg-accent-hover max-[768px]:order-1 max-[768px]:basis-auto`}
        >
          {WORK_CARD_VIEW_LABEL}
        </a>
      ) : (
        <span
          className={`${doujinWorkCardCtaBaseClassName} min-w-0 basis-[60%] cursor-not-allowed border border-border bg-surface text-muted max-[768px]:order-1 max-[768px]:basis-auto`}
          title="アフィリエイトURL準備中"
        >
          準備中
        </span>
      )}
      <div className="min-w-0 basis-[40%] max-[768px]:order-2 max-[768px]:basis-auto">
        <DoujinCompareToggleButton
          workId={workId}
          title={title}
          variant="card"
        />
      </div>
    </div>
  );
}

export const DoujinWorkCardCtaRow = memo(
  DoujinWorkCardCtaRowInner,
  (prev, next) =>
    prev.workId === next.workId &&
    prev.title === next.title &&
    prev.affiliateUrl === next.affiliateUrl &&
    prev.className === next.className,
);
