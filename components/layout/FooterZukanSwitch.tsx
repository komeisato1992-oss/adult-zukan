"use client";

import {
  ZukanSwitchButton,
  zukanSwitchVariantClassName,
  type ZukanSwitchSite,
} from "@/components/home/ZukanSwitchButton";

const FOOTER_SWITCH = {
  adult: {
    label: "同人図鑑はこちら",
    href: "/doujin",
    variant: "doujin" as const,
    fromSite: "adult" as const,
    toSite: "doujin" as const,
    descriptionLine1: "同人作品を、価格・サークル・作者・シリーズ・ジャンルから",
    descriptionLine2: "検索・比較できます。",
  },
  doujin: {
    label: "アダルト図鑑はこちら",
    href: "/",
    variant: "adult" as const,
    fromSite: "doujin" as const,
    toSite: "adult" as const,
    descriptionLine1: "動画作品を、女優・メーカー・レーベル・シリーズ・ジャンルから",
    descriptionLine2: "検索・比較できます。",
  },
} as const;

type FooterZukanSwitchProps = {
  currentSite: ZukanSwitchSite;
};

export function FooterZukanSwitch({ currentSite }: FooterZukanSwitchProps) {
  const config = FOOTER_SWITCH[currentSite];

  return (
    <div>
      <ZukanSwitchButton
        label={config.label}
        href={config.href}
        variant={config.variant}
        fromSite={config.fromSite}
        toSite={config.toSite}
        placement="footer_left"
        className={`inline-flex h-11 w-full max-w-[280px] items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors sm:w-[240px] ${zukanSwitchVariantClassName(config.variant)}`}
      />
      <p className="mt-3 max-w-[360px] text-[13px] leading-[1.6] text-muted sm:mt-4 sm:text-sm">
        {config.descriptionLine1}
        <br />
        {config.descriptionLine2}
      </p>
    </div>
  );
}
