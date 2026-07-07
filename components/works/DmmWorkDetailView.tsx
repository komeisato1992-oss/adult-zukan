import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { DmmWorkDetailBody } from "@/components/works/DmmWorkDetailBody";
import { DmmWorkInternalLinks } from "@/components/works/DmmWorkInternalLinks";
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
import { getDmmWorkInternalLinks } from "@/lib/dmm/internal-links";
import {
  getDmmReleaseDateInfo,
} from "@/lib/dmm/release-date";
import {
  createBreadcrumbJsonLd,
  createDmmProductJsonLd,
} from "@/lib/seo/json-ld";

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
  const internalLinkSections = await getDmmWorkInternalLinks(item);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "作品一覧", path: "/works" },
            { name: item.title, path: `/works/${item.content_id}` },
          ]),
          createDmmProductJsonLd(item),
        ]}
      />
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
          />
          <DmmWorkInternalLinks sections={internalLinkSections} />
        </div>
      </PageLayout>
    </>
  );
}
