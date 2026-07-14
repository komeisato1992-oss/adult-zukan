type FanzaTvUnlimitedCtaProps = {
  href: string;
  className?: string;
};

function TvPlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * 月額見放題への第2CTA（全作品共通のFANZA TV登録アフィリエイト）。
 */
export function FanzaTvUnlimitedCta({
  href,
  className = "",
}: FanzaTvUnlimitedCtaProps) {
  if (!href) return null;

  return (
    <div
      className={`flex w-full max-w-[min(90%,420px)] flex-col items-center min-[769px]:max-w-[420px] ${className}`.trim()}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent-light px-4 py-3 text-[14px] font-bold text-accent shadow-sm transition-colors hover:bg-[#ffe4e8] min-[769px]:min-h-[48px] min-[769px]:text-[15px]"
      >
        <TvPlayIcon className="shrink-0" />
        月額見放題はこちら
        <span aria-hidden>↗</span>
      </a>
      <p className="mt-1.5 text-center text-[11px] leading-snug text-muted min-[769px]:text-[12px]">
        14日無料でトライアル！登録はこちらから
      </p>
    </div>
  );
}
