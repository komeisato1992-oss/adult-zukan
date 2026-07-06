import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DmmWorkDetailBody } from "@/components/works/DmmWorkDetailBody";
import type { DmmItem } from "@/lib/dmm/types";
import {
  getDmmInfoRows,
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmSampleImages,
  getDmmSampleMovieUrl,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { getDmmRelatedWorks } from "@/lib/dmm/get-related-works";
import {
  getDmmReleaseDateInfo,
} from "@/lib/dmm/release-date";

type DmmWorkDetailViewProps = {
  item: DmmItem;
};

export async function DmmWorkDetailView({ item }: DmmWorkDetailViewProps) {
  const imageUrl = getDmmItemImageUrl(item);
  const sampleImages = getDmmSampleImages(item);
  const sampleMovie = getDmmSampleMovieUrl(item);
  const sampleMoviePoster = sampleMovie
    ? (sampleImages[0] ?? imageUrl)
    : undefined;
  const fanzaUrl = getDmmFanzaUrl(item);
  const infoRows = getDmmInfoRows(item);
  const relatedItems = await getDmmRelatedWorks(item);

  return (
    <PageLayout>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "作品一覧", href: "/works" },
          { label: item.title },
        ]}
      />

      <div className="mt-6">
        <DmmWorkDetailBody
          item={item}
          fanzaUrl={fanzaUrl}
          imageUrl={imageUrl}
          sampleImages={sampleImages}
          sampleMovie={sampleMovie}
          sampleMoviePoster={sampleMoviePoster}
          infoRows={infoRows}
          makerName={getDmmItemMakerName(item)}
          labelName={getDmmItemLabelName(item)}
          actressNameList={getDmmItemActressNameList(item)}
          price={getDmmItemPrice(item)}
          releaseDate={getDmmReleaseDateInfo(item)}
          relatedItems={relatedItems}
        />
      </div>
    </PageLayout>
  );
}
