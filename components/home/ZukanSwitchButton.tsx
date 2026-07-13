"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sendGaEvent } from "@/lib/gtag";

export type ZukanSwitchSite = "adult" | "doujin";

type ZukanSwitchButtonProps = {
  label: string;
  href: string;
  variant: ZukanSwitchSite;
  fromSite: ZukanSwitchSite;
  toSite: ZukanSwitchSite;
  placement?: string;
  className?: string;
};

const variantClassName: Record<ZukanSwitchSite, string> = {
  adult: "bg-[#E60012] text-white hover:bg-[#C40010]",
  doujin: "bg-[#F78FA7] text-white hover:bg-[#E56B8A]",
};

export function ZukanSwitchButton({
  label,
  href,
  variant,
  fromSite,
  toSite,
  placement = "top_hero",
  className,
}: ZukanSwitchButtonProps) {
  const pathname = usePathname();

  const handleClick = () => {
    try {
      sendGaEvent("zukan_switch_click", {
        from_site: fromSite,
        to_site: toSite,
        placement,
        link_text: label,
        page_path: pathname || "/",
      });
    } catch {
      // GA失敗でも遷移は止めない
    }
  };

  return (
    <Link
      href={href}
      prefetch
      onClick={handleClick}
      className={
        className ??
        `mt-3 inline-flex h-11 w-full max-w-[280px] items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors sm:mt-4 sm:w-[240px] ${variantClassName[variant]}`
      }
    >
      {label}
    </Link>
  );
}

export function zukanSwitchVariantClassName(
  variant: ZukanSwitchSite,
): string {
  return variantClassName[variant];
}
