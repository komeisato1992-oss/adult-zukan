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
  getDmmItemReviewLabel,
  getDmmItemVolumeLabel,
  getDmmSampleImages,
  getDmmSampleMovieUrl,
} from "@/lib/dmm/display";
import { getDmmDescriptionTeaser } from "@/lib/dmm/description";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { getDmmWorkInternalLinks } from "@/lib/dmm/internal-links";
import { resolveDmmItemDescription } from "@/lib/dmm/resolve-description";
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
  const description = await resolveDmmItemDescription(item);
  const descriptionTeaser = description
    ? getDmmDescriptionTeaser(description)
    : undefined;
  const infoRows = getDmmInfoRows(item, description);
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
          createDmmProductJsonLd(item, description),
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
            description={description}
            descriptionTeaser={descriptionTeaser}
            imageUrl={imageUrl}
            sampleImages={sampleImages}
            sampleMovie={sampleMovie}
            sampleMoviePoster={sampleMoviePoster}
            infoRows={infoRows}
            makerName={getDmmItemMakerName(item)}
            labelName={getDmmItemLabelName(item)}
            actressNameList={getDmmItemActressNameList(item)}
            price={getDmmItemPrice(item)}
            volumeLabel={getDmmItemVolumeLabel(item)}
            reviewLabel={getDmmItemReviewLabel(item)}
            releaseDate={getDmmReleaseDateInfo(item)}
          />
          <DmmWorkInternalLinks sections={internalLinkSections} />
        </div>
      </PageLayout>
    </>
  );
}
