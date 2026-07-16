"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import { DmmSampleMovieThumbnail } from "@/components/works/DmmSampleMovieThumbnail";
import { DmmActressCompactLinks } from "@/components/works/DmmActressCompactLinks";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { FanzaTvUnlimitedCta } from "@/components/works/FanzaTvUnlimitedCta";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";
import { WorkDescriptionReadMore } from "@/components/works/WorkDescriptionReadMore";
import { FavoriteButton } from "@/components/user/FavoriteButton";
import { FavoriteCardButton } from "@/components/user/FavoriteCardButton";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkHeroProps = {
  title: string;
  contentId: string;
  description?: string;
  descriptionTeaser?: string;
  actressNameList?: string[];
  makerName?: string;
  labelName?: string;
  releaseDate?: DmmReleaseDateInfo;
  price?: string;
  volumeLabel?: string;
  reviewLabel?: string;
  imageUrl?: string;
  sampleMovie?: string;
  sampleMoviePoster?: string;
  fanzaUrl: string;
  fanzaTvUrl?: string;
};

type HighlightCard = {
  key: string;
  label: string;
  value: ReactNode;
  valueClassName?: string;
  /** デフォルトは両方表示 */
  visibility?: "all" | "mobile" | "desktop";
  align?: "start" | "center";
};

function HighlightCardCell({ card }: { card: HighlightCard }) {
  const visibilityClass =
    card.visibility === "mobile"
      ? "min-[769px]:hidden"
      : card.visibility === "desktop"
        ? "hidden min-[769px]:block"
        : "";
  const centered = card.align === "center";

  return (
    <div
      className={`min-w-0 rounded-lg border border-[#ececec] bg-[#fafafa] px-2.5 py-2 ${
        centered ? "text-center" : ""
      } ${visibilityClass}`.trim()}
    >
      <dt
        className={`text-[11px] leading-none text-[#888] ${
          centered ? "text-center" : ""
        }`}
      >
        {card.label}
      </dt>
      <dd
        className={`mt-1.5 min-w-0 break-words text-[13px] font-medium leading-snug min-[769px]:text-[14px] ${
          centered ? "text-center" : ""
        } ${card.valueClassName ?? "text-foreground"}`}
      >
        {card.value}
      </dd>
    </div>
  );
}

/**
 * 作品詳細ヒーロー（PC/スマホで情報構成を統一）
 * 画像 → タイトル → 説明 → 主要情報 → 価格(PC) → CTA群
 */
export function DmmWorkHero({
  title,
  contentId,
  description,
  descriptionTeaser,
  actressNameList,
  releaseDate,
  price,
  volumeLabel,
  reviewLabel,
  imageUrl,
  sampleMovie,
  sampleMoviePoster,
  fanzaUrl,
  fanzaTvUrl,
}: DmmWorkHeroProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  // 画像なし判定は追加・更新時の image_status。閲覧時は渡された URL をそのまま使う。
  const safeImageUrl = imageUrl?.trim() || undefined;
  const samplePoster = sampleMoviePoster?.trim() || safeImageUrl;
  const showSampleThumbnail = Boolean(sampleMovie && fanzaUrl && samplePoster);
  const hasActresses = Boolean(actressNameList && actressNameList.length > 0);

  const descriptionText = description || descriptionTeaser;

  const highlights: HighlightCard[] = [];
  if (hasActresses) {
    highlights.push({
      key: "actress",
      label: "女優",
      value: <DmmActressCompactLinks names={actressNameList!} />,
    });
  }
  if (releaseDate) {
    highlights.push({
      key: "release",
      label: releaseDate.label,
      value: releaseDate.value,
    });
  }
  if (volumeLabel) {
    highlights.push({
      key: "volume",
      label: "収録時間",
      value: volumeLabel,
    });
  }
  // スマホ: 評価の位置を価格カードへ。PC: 評価を維持
  if (price) {
    highlights.push({
      key: "price-mobile",
      label: "価格",
      value: price,
      valueClassName: "font-bold text-price text-[18px] leading-none",
      visibility: "mobile",
    });
  }
  if (reviewLabel) {
    highlights.push({
      key: "review",
      label: "評価",
      value: reviewLabel,
      visibility: "desktop",
    });
  }

  return (
    <>
      <section
        aria-label="作品概要"
        className="scroll-mt-[calc(56px+env(safe-area-inset-top,0px))] rounded-none border-0 bg-transparent p-0 shadow-none max-[768px]:pt-1"
      >
        <div className="grid gap-5 max-[768px]:gap-3 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-stretch lg:gap-8">
          <div className="mx-auto w-full max-w-[280px] max-[768px]:my-1 max-[768px]:max-w-[min(92vw,420px)] lg:mx-0 lg:max-w-[320px]">
            {safeImageUrl ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveImage(safeImageUrl)}
                  className="block w-full cursor-zoom-in border-0 bg-transparent p-0 shadow-none"
                  aria-label={`${title} のジャケット画像を拡大表示`}
                >
                  <Image
                    src={safeImageUrl}
                    alt={title}
                    width={360}
                    height={510}
                    className="mx-auto h-auto w-full rounded-lg object-contain max-[768px]:max-h-[min(48vh,380px)]"
                    sizes="(max-width: 768px) 92vw, 320px"
                    priority
                    unoptimized
                  />
                </button>
                <FavoriteCardButton contentId={contentId} title={title} />
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center text-sm text-muted">
                画像なし
              </div>
            )}

            {showSampleThumbnail && samplePoster && (
              <DmmSampleMovieThumbnail
                posterUrl={samplePoster}
                title={title}
                fanzaUrl={fanzaUrl}
              />
            )}
          </div>

          <div className="flex min-w-0 flex-col lg:min-h-full">
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold leading-[1.35] text-foreground line-clamp-3 min-[769px]:text-xl min-[769px]:leading-snug lg:text-[22px] lg:leading-snug">
                {title}
              </h1>

              {descriptionText ? (
                <WorkDescriptionReadMore
                  className="mt-2.5 max-[768px]:mt-2"
                  lines={3}
                >
                  {descriptionText}
                </WorkDescriptionReadMore>
              ) : null}

              {highlights.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-2 min-[769px]:grid-cols-3 min-[769px]:gap-2.5 lg:grid-cols-4">
                  {highlights.map((card) => (
                    <HighlightCardCell key={card.key} card={card} />
                  ))}
                </dl>
              ) : null}

              {/* PCのみ: ボタン上の価格（ラベル付き） */}
              {price ? (
                <div className="mt-3.5 hidden min-[769px]:block">
                  <p className="text-sm font-medium text-foreground">価格</p>
                  <p className="mt-1 text-xl font-bold leading-none text-price">
                    {price}
                  </p>
                </div>
              ) : null}
            </div>

            {/*
              PC: 左カラム（画像＋サンプル動画）下端と
              月額見放題CTA下端が揃うよう、CTAをカラム下部へ寄せる
            */}
            <div className="mt-3.5 flex flex-col items-center min-[769px]:mt-auto min-[769px]:pt-4">
              <FanzaLinkButton href={fanzaUrl} />

              <div className="mt-2.5 grid w-[min(90%,420px)] grid-cols-2 gap-2 min-[769px]:w-full min-[769px]:max-w-[420px]">
                <CompareToggleButton
                  contentId={contentId}
                  title={title}
                  variant="outline"
                  className="!h-11 !min-h-[44px] !rounded-lg !px-2 !text-[13px]"
                />
                <FavoriteButton contentId={contentId} title={title} />
              </div>

              {fanzaTvUrl ? (
                <FanzaTvUnlimitedCta href={fanzaTvUrl} className="mt-2.5" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {activeImage && (
        <ImageLightboxModal
          src={activeImage}
          alt={title}
          onClose={() => setActiveImage(null)}
        />
      )}
    </>
  );
}
