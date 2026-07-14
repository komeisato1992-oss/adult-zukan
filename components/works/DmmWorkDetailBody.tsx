"use client";

import { DmmSampleGallery } from "@/components/works/DmmSampleGallery";
import { DmmWorkHero } from "@/components/works/DmmWorkHero";
import { DmmWorkInfoTable } from "@/components/works/DmmWorkInfoTable";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { FanzaTvUnlimitedCta } from "@/components/works/FanzaTvUnlimitedCta";
import type { DmmInfoRow } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkDetailBodyProps = {
  item: DmmItem;
  fanzaUrl: string;
  fanzaTvUrl?: string;
  description?: string;
  descriptionTeaser?: string;
  imageUrl?: string;
  sampleImages: string[];
  sampleMovie?: string;
  sampleMoviePoster?: string;
  infoRows: DmmInfoRow[];
  makerName?: string;
  labelName?: string;
  actressNameList?: string[];
  price?: string;
  volumeLabel?: string;
  reviewLabel?: string;
  releaseDate?: DmmReleaseDateInfo;
};

export function DmmWorkDetailBody({
  item,
  fanzaUrl,
  fanzaTvUrl,
  description,
  descriptionTeaser,
  imageUrl,
  sampleImages,
  sampleMovie,
  sampleMoviePoster,
  infoRows,
  makerName,
  labelName,
  actressNameList,
  price,
  volumeLabel,
  reviewLabel,
  releaseDate,
}: DmmWorkDetailBodyProps) {
  return (
    <article className="pb-[calc(48px+env(safe-area-inset-bottom,0px))] max-[768px]:pb-[calc(48px+env(safe-area-inset-bottom,0px))]">
      <DmmWorkHero
        title={item.title}
        contentId={item.content_id}
        description={description}
        descriptionTeaser={descriptionTeaser}
        actressNameList={actressNameList}
        makerName={makerName}
        labelName={labelName}
        releaseDate={releaseDate}
        price={price}
        volumeLabel={volumeLabel}
        reviewLabel={reviewLabel}
        imageUrl={imageUrl}
        sampleMovie={sampleMovie}
        sampleMoviePoster={sampleMoviePoster}
        fanzaUrl={fanzaUrl}
        fanzaTvUrl={fanzaTvUrl}
      />

      <DmmSampleGallery images={sampleImages} title={item.title} />

      <DmmWorkInfoTable rows={infoRows} />

      {/* 作品情報直後の再CTA（購入導線） */}
      <div className="mt-8 flex flex-col items-center gap-2.5">
        <FanzaLinkButton href={fanzaUrl} />
        {fanzaTvUrl ? <FanzaTvUnlimitedCta href={fanzaTvUrl} /> : null}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        ※ 18歳未満の方の閲覧は固くお断りします。外部サイト（FANZA）へ移動します。
      </p>
    </article>
  );
}
