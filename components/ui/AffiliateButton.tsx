import type { AffiliateProvider } from "@/data/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { getAffiliateLabel } from "@/lib/format";

type AffiliateButtonProps = {
  url: string;
  provider: AffiliateProvider;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
};

export function AffiliateButton({
  url,
  provider,
  size = "md",
  className = "",
}: AffiliateButtonProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel={AFFILIATE_LINK_REL}
      className={`inline-flex items-center justify-center rounded bg-accent font-semibold text-white transition-colors hover:bg-accent-hover ${sizeClasses[size]} ${className}`}
    >
      {getAffiliateLabel(provider)}
    </a>
  );
}
