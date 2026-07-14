import Link from "next/link";
import type { ReactNode } from "react";
import { DmmActressLinks } from "@/components/works/DmmActressLinks";
import { getLabelDetailPath, getMakerDetailPath } from "@/lib/entities/paths";
import { slugify } from "@/lib/utils";

export type DmmWorkMobileInfoCardsProps = {
  contentId: string;
  actressNameList?: string[];
  price?: string;
  releaseDateLabel?: string;
  releaseDateValue?: string;
  volumeLabel?: string;
  makerName?: string;
  labelName?: string;
  reviewLabel?: string;
  className?: string;
};

type InfoCard = {
  key: string;
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

function EntityLink({
  name,
  getPath,
}: {
  name: string;
  getPath: (slug: string) => string;
}) {
  const slug = slugify(name);
  if (!slug) {
    return <span className="text-foreground">{name}</span>;
  }
  return (
    <Link href={getPath(slug)} className="text-accent hover:underline">
      {name}
    </Link>
  );
}

function InfoCardCell({ card }: { card: InfoCard }) {
  return (
    <div className="min-w-0 rounded-[11px] border border-[#ececec] bg-[#fafafa] px-2.5 py-2 max-[389px]:px-2 max-[389px]:py-1.5">
      <dt className="text-[11px] leading-none text-[#888] max-[389px]:text-[10px]">
        {card.label}
      </dt>
      <dd
        className={`mt-1.5 min-w-0 break-words text-[15px] leading-snug max-[389px]:mt-1 max-[389px]:text-[14px] ${
          card.valueClassName ?? "font-medium text-foreground"
        }`}
      >
        {card.value}
      </dd>
    </div>
  );
}

/**
 * スマートフォン作品詳細用の2列情報カード。
 * PCでは呼び出さない（親側で min-[769px]:hidden）。
 */
export function DmmWorkMobileInfoCards({
  contentId,
  actressNameList,
  price,
  releaseDateLabel = "発売日",
  releaseDateValue,
  volumeLabel,
  makerName,
  labelName,
  reviewLabel,
  className = "",
}: DmmWorkMobileInfoCardsProps) {
  const cards: InfoCard[] = [];

  if (actressNameList && actressNameList.length > 0) {
    cards.push({
      key: "actress",
      label: "女優",
      value: <DmmActressLinks names={actressNameList} />,
      valueClassName: "font-medium",
    });
  }
  if (price) {
    cards.push({
      key: "price",
      label: "価格",
      value: price,
      valueClassName: "font-bold text-price",
    });
  }
  if (releaseDateValue) {
    cards.push({
      key: "release",
      label: releaseDateLabel,
      value: releaseDateValue,
    });
  }
  if (volumeLabel) {
    cards.push({
      key: "volume",
      label: "再生時間",
      value: volumeLabel,
    });
  }
  if (makerName) {
    cards.push({
      key: "maker",
      label: "メーカー",
      value: <EntityLink name={makerName} getPath={getMakerDetailPath} />,
    });
  }
  if (labelName) {
    cards.push({
      key: "label",
      label: "レーベル",
      value: <EntityLink name={labelName} getPath={getLabelDetailPath} />,
    });
  }
  if (contentId) {
    cards.push({
      key: "contentId",
      label: "品番",
      value: contentId,
    });
  }
  if (reviewLabel) {
    cards.push({
      key: "review",
      label: "評価",
      value: reviewLabel,
    });
  }

  if (cards.length === 0) return null;

  return (
    <dl
      className={`grid grid-cols-2 gap-2 max-[389px]:gap-1.5 ${className}`.trim()}
    >
      {cards.map((card) => (
        <InfoCardCell key={card.key} card={card} />
      ))}
    </dl>
  );
}
