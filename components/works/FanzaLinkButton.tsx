import { WORK_CARD_VIEW_LABEL } from "@/components/works/work-card-cta-styles";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type FanzaLinkButtonProps = {
  href: string;
  className?: string;
};

export function FanzaLinkButton({ href, className = "" }: FanzaLinkButtonProps) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel={AFFILIATE_LINK_REL}
      className={`inline-flex w-full max-w-[min(90%,420px)] items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover min-[769px]:max-w-[420px] min-[769px]:min-h-[48px] min-[769px]:rounded-lg min-[769px]:text-[15px] max-[768px]:min-h-[54px] max-[768px]:rounded-lg max-[768px]:py-4 max-[768px]:text-[15px] max-[768px]:shadow-sm ${className}`}
    >
      {WORK_CARD_VIEW_LABEL}
      <span className="hidden max-[768px]:inline" aria-hidden>
        ↗
      </span>
    </a>
  );
}
