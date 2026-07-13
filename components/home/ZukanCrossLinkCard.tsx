"use client";

import {
  ZukanSwitchButton,
  zukanSwitchVariantClassName,
  type ZukanSwitchSite,
} from "@/components/home/ZukanSwitchButton";

export type ZukanCrossLinkCardProps = {
  title: string;
  description: string;
  label: string;
  href: string;
  variant: ZukanSwitchSite;
  fromSite: ZukanSwitchSite;
  toSite: ZukanSwitchSite;
  placement?: string;
};

const cardFrameClassName: Record<ZukanSwitchSite, string> = {
  // 同人図鑑へ（成人図鑑TOP）：薄いピンク枠
  doujin: "border-[#F9C2CF] shadow-[0_1px_3px_rgba(247,143,167,0.18)]",
  // アダルト図鑑へ（同人図鑑TOP）：薄い赤枠
  adult: "border-[#FFC9C9] shadow-[0_1px_3px_rgba(230,0,18,0.12)]",
};

/**
 * TOPヒーロー用の相互導線カード。
 * 主要CTAより一段控えめに見せる案内ブロック。
 */
export function ZukanCrossLinkCard({
  title,
  description,
  label,
  href,
  variant,
  fromSite,
  toSite,
  placement = "top_hero_card",
}: ZukanCrossLinkCardProps) {
  return (
    <aside
      className={`mx-auto mt-7 w-full max-w-[580px] rounded-xl border bg-white px-5 py-5 text-center sm:mt-8 sm:px-6 sm:py-6 ${cardFrameClassName[variant]}`}
      aria-label={title}
    >
      <p className="text-base font-bold leading-snug text-[#1a1a1a] sm:text-lg">
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-[1.7] text-[#737373] sm:text-sm">
        {description}
      </p>
      <ZukanSwitchButton
        label={label}
        href={href}
        variant={variant}
        fromSite={fromSite}
        toSite={toSite}
        placement={placement}
        className={`mt-4 inline-flex h-11 w-full max-w-none items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors sm:w-[220px] sm:max-w-[240px] ${zukanSwitchVariantClassName(variant)}`}
      />
    </aside>
  );
}
