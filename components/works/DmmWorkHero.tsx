"use client";

import Image from "next/image";
import { useState } from "react";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import { DmmSampleMovieThumbnail } from "@/components/works/DmmSampleMovieThumbnail";
import { DmmActressLinks } from "@/components/works/DmmActressLinks";
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
  imageUrl,
  sampleMovie,
  sampleMoviePoster,
  fanzaUrl,
}: DmmWorkHeroProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const samplePoster = sampleMoviePoster ?? imageUrl;
  const showSampleThumbnail = Boolean(sampleMovie && fanzaUrl && samplePoster);

  return (
    <>
      <section
        aria-label="作品概要"
        className="rounded-none border-0 bg-transparent p-0 shadow-none"
      >
        <div className="grid gap-8 max-[768px]:gap-5 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-[280px] max-[768px]:max-w-[min(78vw,240px)] lg:mx-0">
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
                  className="mx-auto h-auto w-full object-contain"
                  sizes="(max-width: 768px) 78vw, 280px"
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight text-foreground max-[768px]:line-clamp-4 max-[768px]:text-[20px] max-[768px]:leading-snug sm:text-2xl lg:text-3xl">
                {title}
              </h1>
              <FavoriteButton contentId={contentId} title={title} />
            </div>

            {descriptionTeaser && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted max-[768px]:text-[14px]">
                {descriptionTeaser}
              </p>
            )}

            <dl className="mt-6 space-y-3 text-sm max-[768px]:mt-4 max-[768px]:space-y-2.5">
              <div>
                <dt className="text-muted">品番</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {contentId}
                </dd>
              </div>
              {actressNameList && actressNameList.length > 0 && (
                <div>
                  <dt className="text-muted">女優</dt>
                  <dd className="mt-0.5 text-foreground">
                    <DmmActressLinks names={actressNameList} />
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
                  <dd className="mt-0.5 text-xl font-bold text-price max-[768px]:text-lg">
                    {price}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6 max-[768px]:mt-5 max-[768px]:flex max-[768px]:flex-col max-[768px]:items-center">
              <FanzaLinkButton href={fanzaUrl} />
              <div className="mt-3 w-full max-w-[300px] max-[768px]:mx-auto max-[768px]:w-[min(85%,280px)]">
                <CompareToggleButton
                  contentId={contentId}
                  title={title}
                  variant="outline"
                />
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
