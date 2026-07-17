"use client";

import {
  ZukanCrossLinkCard,
  type ZukanCrossLinkCardProps,
} from "@/components/home/ZukanCrossLinkCard";

/** アダルト図鑑 → 同人図鑑の案内カード（ヒーロー／フッター共用の文言） */
export const ADULT_DOUJIN_CROSS_LINK = {
  title: "同人作品を探している方へ",
  description:
    "同人作品を、作者やシリーズ、ジャンルから検索・比較できます",
  label: "同人図鑑を見る →",
  href: "/doujin",
  variant: "doujin" as const,
  fromSite: "adult" as const,
  toSite: "doujin" as const,
};

type DoujinGuideCrossLinkCardProps = {
  placement: string;
  className?: string;
};

/**
 * ヒーロー下・フッター上部で同じUIを再利用する同人図鑑案内カード。
 */
export function DoujinGuideCrossLinkCard({
  placement,
  className,
}: DoujinGuideCrossLinkCardProps) {
  const props: ZukanCrossLinkCardProps = {
    ...ADULT_DOUJIN_CROSS_LINK,
    placement,
    className,
  };
  return <ZukanCrossLinkCard {...props} />;
}
