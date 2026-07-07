"use client";

import { DmmSampleGallery } from "@/components/works/DmmSampleGallery";
import { DmmWorkHero } from "@/components/works/DmmWorkHero";
import { DmmWorkInfoTable } from "@/components/works/DmmWorkInfoTable";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";
import { AffiliateDisclosureNote } from "@/components/ui/AffiliateDisclosureNote";
import type { DmmInfoRow } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import type { DmmReleaseDateInfo } from "@/lib/dmm/release-date";

type DmmWorkDetailBodyProps = {
  item: DmmItem;
  fanzaUrl: string;
  imageUrl?: string;
  sampleImages: string[];
  sampleMovie?: string;
  sampleMoviePoster?: string;
  infoRows: DmmInfoRow[];
  makerName?: string;
  labelName?: string;
  actressNameList?: string[];
  price?: string;
  releaseDate?: DmmReleaseDateInfo;
};

export function DmmWorkDetailBody({
  item,
  fanzaUrl,
  imageUrl,
  sampleImages,
  sampleMovie,
  sampleMoviePoster,
  infoRows,
  makerName,
  labelName,
  actressNameList,
  price,
  releaseDate,
}: DmmWorkDetailBodyProps) {
  return (
    <article>
      <DmmWorkHero
        title={item.title}
        contentId={item.content_id}
        actressNameList={actressNameList}
        makerName={makerName}
        labelName={labelName}
        releaseDate={releaseDate}
        price={price}
        imageUrl={imageUrl}
        sampleMovie={sampleMovie}
        sampleMoviePoster={sampleMoviePoster}
        fanzaUrl={fanzaUrl}
      />

      <DmmSampleGallery images={sampleImages} title={item.title} />

      <DmmWorkInfoTable rows={infoRows} />

      <div className="mt-8 flex flex-col items-center">
        <FanzaLinkButton href={fanzaUrl} />
        <AffiliateDisclosureNote className="mt-2 text-center" />
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        ※ 18歳未満の方の閲覧は固くお断りします。外部サイト（FANZA）へ移動します。
      </p>
    </article>
  );
}
