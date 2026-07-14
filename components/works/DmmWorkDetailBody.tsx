"use client";

import { DmmSampleGallery } from "@/components/works/DmmSampleGallery";
import { DmmWorkHero } from "@/components/works/DmmWorkHero";
import { DmmWorkInfoTable } from "@/components/works/DmmWorkInfoTable";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { WorkDescriptionReadMore } from "@/components/works/WorkDescriptionReadMore";
import type { DmmInfoRow } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkDetailBodyProps = {
  item: DmmItem;
  fanzaUrl: string;
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
    <article>
      <DmmWorkHero
        title={item.title}
        contentId={item.content_id}
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
      />

      {/* スマートフォン: 作品内容（折りたたみ）。PCは情報テーブル内の作品説明を維持 */}
      {description ? (
        <WorkDescriptionReadMore
          heading="作品内容"
          headingId="work-content-mobile"
          className="mt-7 min-[769px]:hidden"
        >
          {description}
        </WorkDescriptionReadMore>
      ) : null}

      <DmmSampleGallery images={sampleImages} title={item.title} />

      <DmmWorkInfoTable rows={infoRows} />

      {/* 下部CTAはPCのみ（モバイルは上部主CTAに集約） */}
      <div className="mt-8 hidden flex-col items-center min-[769px]:flex">
        <FanzaLinkButton href={fanzaUrl} />
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted max-[768px]:mt-6">
        ※ 18歳未満の方の閲覧は固くお断りします。外部サイト（FANZA）へ移動します。
      </p>
    </article>
  );
}
