"use client";

import Image from "next/image";
import { useState } from "react";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import { DmmSampleMovieThumbnail } from "@/components/works/DmmSampleMovieThumbnail";
import { DmmActressLinks } from "@/components/works/DmmActressLinks";
import { DmmWorkMobileInfoCards } from "@/components/works/DmmWorkMobileInfoCards";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";
import { FavoriteButton } from "@/components/user/FavoriteButton";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkHeroProps = {
  title: string;
  contentId: string;
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
};

export function DmmWorkHero({
  title,
  contentId,
  descriptionTeaser,
  actressNameList,
  makerName,
  labelName,
  releaseDate,
  price,
  volumeLabel,
  reviewLabel,
  imageUrl,
  sampleMovie,
  sampleMoviePoster,
  fanzaUrl,
}: DmmWorkHeroProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const samplePoster = sampleMoviePoster ?? imageUrl;
  const showSampleThumbnail = Boolean(sampleMovie && fanzaUrl && samplePoster);
  const hasActresses = Boolean(actressNameList && actressNameList.length > 0);

  return (
    <>
      <section
        aria-label="作品概要"
        className="scroll-mt-[calc(56px+env(safe-area-inset-top,0px))] rounded-none border-0 bg-transparent p-0 shadow-none max-[768px]:pt-1"
      >
        <div className="grid gap-8 max-[768px]:gap-4 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start lg:gap-10">
          {/* 画像・動画（PC/スマホ共通ノードで二重ロード防止） */}
          <div className="mx-auto w-full max-w-[280px] max-[768px]:my-2 max-[768px]:max-w-[min(92vw,420px)] lg:mx-0">
            {imageUrl ? (
              <button
                type="button"
                onClick={() => setActiveImage(imageUrl)}
                className="block w-full cursor-zoom-in border-0 bg-transparent p-0 shadow-none"
                aria-label={`${title} のジャケット画像を拡大表示`}
              >
                <Image
                  src={imageUrl}
                  alt={title}
                  width={320}
                  height={454}
                  className="mx-auto h-auto w-full rounded-lg object-contain max-[768px]:max-h-[min(52vh,420px)]"
                  sizes="(max-width: 768px) 92vw, 280px"
                  priority
                  unoptimized
                />
              </button>
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

          <div className="min-w-0">
            {/* タイトル（共通の単一 h1）＋ PCのみお気に入り横並び */}
            <div className="flex flex-wrap items-start justify-between gap-3 max-[768px]:block">
              <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight text-foreground max-[768px]:w-full max-[768px]:flex-none max-[768px]:line-clamp-4 max-[768px]:text-[19px] max-[768px]:leading-[1.4] sm:text-2xl lg:text-3xl">
                {title}
              </h1>
              <FavoriteButton
                contentId={contentId}
                title={title}
                className="hidden min-[769px]:inline-flex"
              />
            </div>

            {/* ========== PC (≥769px): 既存レイアウト維持 ========== */}
            <div className="hidden min-[769px]:block">
              {descriptionTeaser && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                  {descriptionTeaser}
                </p>
              )}

              <dl className="mt-6 space-y-3 text-sm">
                <div>
                  <dt className="text-muted">品番</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {contentId}
                  </dd>
                </div>
                {hasActresses && (
                  <div>
                    <dt className="text-muted">女優</dt>
                    <dd className="mt-0.5 text-foreground">
                      <DmmActressLinks names={actressNameList!} />
                    </dd>
                  </div>
                )}
                {makerName && (
                  <div>
                    <dt className="text-muted">メーカー</dt>
                    <dd className="mt-0.5 text-foreground">{makerName}</dd>
                  </div>
                )}
                {labelName && (
                  <div>
                    <dt className="text-muted">レーベル</dt>
                    <dd className="mt-0.5 text-foreground">{labelName}</dd>
                  </div>
                )}
                {releaseDate && (
                  <div>
                    <dt className="text-muted">{releaseDate.label}</dt>
                    <dd className="mt-0.5 text-foreground">{releaseDate.value}</dd>
                  </div>
                )}
                {price && (
                  <div>
                    <dt className="text-muted">価格</dt>
                    <dd className="mt-0.5 text-xl font-bold text-price">
                      {price}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-6">
                <FanzaLinkButton href={fanzaUrl} />
                <div className="mt-3 w-full max-w-[300px]">
                  <CompareToggleButton
                    contentId={contentId}
                    title={title}
                    variant="outline"
                  />
                </div>
              </div>
            </div>

            {/* ========== スマートフォン (≤768px) ========== */}
            <div className="min-[769px]:hidden">
              <DmmWorkMobileInfoCards
                className="mt-3"
                contentId={contentId}
                actressNameList={actressNameList}
                price={price}
                releaseDateLabel={releaseDate?.label}
                releaseDateValue={releaseDate?.value}
                volumeLabel={volumeLabel}
                makerName={makerName}
                labelName={labelName}
                reviewLabel={reviewLabel}
              />

              <div className="mt-4 flex flex-col items-center">
                <FanzaLinkButton href={fanzaUrl} />

                <div className="mt-2.5 grid w-[min(90%,420px)] grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                  <CompareToggleButton
                    contentId={contentId}
                    title={title}
                    variant="outline"
                    className="!h-11 !min-h-[44px] !rounded-lg !px-2 !text-[13px]"
                  />
                  <FavoriteButton
                    contentId={contentId}
                    title={title}
                    compact
                  />
                </div>
              </div>
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
