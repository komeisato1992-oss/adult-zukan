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
      className={`inline-flex w-full max-w-[300px] items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover sm:w-[300px] ${className}`}
    >
      {WORK_CARD_VIEW_LABEL}
    </a>
  );
}
