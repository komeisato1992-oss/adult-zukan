import Link from "next/link";

type MoreSeeScrollCardProps = {
  href: string;
  sectionLabel: string;
  className?: string;
};

/**
 * 横スクロール末尾の「もっと見る」導線カード（DBデータではない UI）。
 */
export function MoreSeeScrollCard({
  href,
  sectionLabel,
  className = "",
}: MoreSeeScrollCardProps) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex shrink-0 snap-start flex-col items-center justify-center rounded-lg border border-border bg-surface px-3 text-center transition-colors hover:border-accent hover:bg-accent-light ${className}`}
      aria-label={`${sectionLabel}をもっと見る`}
    >
      <span className="text-[11px] leading-snug text-muted sm:text-xs">
        {sectionLabel}を
      </span>
      <span className="mt-1 inline-flex items-center gap-0.5 text-sm font-bold text-accent sm:text-base">
        もっと見る
        <span aria-hidden className="text-base leading-none">
          →
        </span>
      </span>
    </Link>
  );
}
