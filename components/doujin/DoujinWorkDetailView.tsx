import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DoujinHistoryTracker } from "@/components/doujin/DoujinHistoryTracker";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinRelatedWorksSection } from "@/components/doujin/DoujinRelatedWorksSection";
import { DoujinSampleGallery } from "@/components/doujin/DoujinSampleGallery";
import { DoujinWorkAuthorsSection } from "@/components/doujin/DoujinWorkAuthorsSection";
import { DoujinWorkDescription } from "@/components/doujin/DoujinWorkDescription";
import { DoujinWorkHero } from "@/components/doujin/DoujinWorkHero";
import { DoujinWorkInfoTable } from "@/components/doujin/DoujinWorkInfoTable";
import { buildDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import { isDoujinFirstTimeGuideEnabled } from "@/lib/doujin/first-time-guide";
import { sanitizeDoujinSampleImageUrls } from "@/lib/doujin/sample-images";
import type { DoujinWork } from "@/lib/doujin/types";
import {
  getDoujinWorkDetailSections,
  getDoujinWorkInfoRows,
  getDoujinWorkPageTeaser,
  resolveDoujinCommentDisplay,
} from "@/lib/doujin/work-detail";

type DoujinWorkDetailViewProps = {
  work: DoujinWork;
};

export function DoujinWorkDetailView({ work }: DoujinWorkDetailViewProps) {
  const imageUrl = getDoujinCardImage(work);
  const sampleImages = sanitizeDoujinSampleImageUrls(work.sampleImageUrls, [
    work.imageUrl,
    work.imageLargeUrl,
    work.imageListUrl,
  ]);
  const affiliateUrl = buildDoujinAffiliateUrl(work);
  const teaser = getDoujinWorkPageTeaser(work);
  const { authorComment, introduction } = resolveDoujinCommentDisplay(work);
  const infoRows = getDoujinWorkInfoRows(work);
  const sections = getDoujinWorkDetailSections(work);
  const primaryCircleId =
    work.circleIds?.[0] ?? work.circleId ?? undefined;
  const primaryCircleName =
    work.circleNames?.[0] ?? work.circleName ?? undefined;
  const showFirstTimeGuide = isDoujinFirstTimeGuideEnabled();

  return (
    <>
      <DoujinHistoryTracker
        workId={work.id}
        title={work.title}
        circleId={primaryCircleId}
        circleName={primaryCircleName}
      />
      <DoujinPageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/doujin" },
            { label: "作品一覧", href: "/doujin/works" },
            { label: work.title },
          ]}
        />

        <div className="mt-6">
          <article>
            <DoujinWorkHero
              work={work}
              imageUrl={imageUrl}
              teaser={teaser}
              affiliateUrl={affiliateUrl}
              hasSampleImages={sampleImages.length > 0}
              authorComment={authorComment}
              showFirstTimeGuide={showFirstTimeGuide}
            />

            <DoujinSampleGallery title={work.title} images={sampleImages} />

            <DoujinWorkInfoTable rows={infoRows} />

            {introduction ? (
              <DoujinWorkDescription description={introduction} />
            ) : null}

            <DoujinWorkAuthorsSection authors={sections.authors} />

            <DoujinRelatedWorksSection
              title="このサークルの作品"
              sectionId="same-circle"
              works={sections.sameCircle}
              moreHref={
                primaryCircleId
                  ? `/doujin/circles/${primaryCircleId}`
                  : undefined
              }
            />

            <DoujinRelatedWorksSection
              title="同じシリーズの作品"
              sectionId="same-series"
              works={sections.sameSeries}
              moreHref={
                work.seriesId ? `/doujin/series/${work.seriesId}` : undefined
              }
            />

            <DoujinRelatedWorksSection
              title="同じジャンルの作品"
              sectionId="same-genre"
              works={sections.sameGenre}
            />

            <DoujinRelatedWorksSection
              title="関連作品"
              sectionId="related-works"
              works={sections.related}
            />

            <DoujinRelatedWorksSection
              title="人気作品"
              sectionId="popular"
              works={sections.popular}
            />

            <DoujinRelatedWorksSection
              title="新着作品"
              sectionId="new"
              works={sections.newest}
            />
          </article>
        </div>
      </DoujinPageLayout>
    </>
  );
}
