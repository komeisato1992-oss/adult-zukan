"use client";

import Image from "next/image";
import { useState } from "react";
import { DmmSampleMovieThumbnail } from "@/components/works/DmmSampleMovieThumbnail";
import { DmmActressLinks } from "@/components/works/DmmActressLinks";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { AffiliateDisclosureNote } from "@/components/ui/AffiliateDisclosureNote";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkHeroProps = {
  title: string;
  contentId: string;
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-[280px] lg:mx-0">
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
                  sizes="(max-width: 1024px) 280px, 280px"
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
            <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl lg:text-3xl">
              {title}
            </h1>

            <dl className="mt-6 space-y-3 text-sm">
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
                  <dd className="mt-0.5 text-xl font-bold text-accent">
                    {price}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6">
              <FanzaLinkButton href={fanzaUrl} />
              <AffiliateDisclosureNote className="mt-2" />
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
