import Link from "next/link";
import { DoujinCompareRelatedWorkCard } from "@/components/doujin/DoujinCompareRelatedWorkCard";
import {
  getDoujinCompareRelatedWorks,
  getDoujinMultiCompareSimilarWorks,
} from "@/lib/doujin/compare/get-similar-works";
import type { DoujinSimilarWorkCardData } from "@/lib/doujin/compare/types";

type DoujinCompareRelatedWorksSectionProps = {
  workIds: string[];
  titleA?: string;
  titleB?: string;
};

function RelatedSection({
  heading,
  works,
  source,
}: {
  heading: string;
  works: DoujinSimilarWorkCardData[];
  source: "both" | "a" | "b" | "multi";
}) {
  if (works.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
        {heading}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 min-[769px]:grid-cols-3 min-[1100px]:grid-cols-4 min-[1400px]:grid-cols-5">
        {works.map((work) => (
          <DoujinCompareRelatedWorkCard
            key={`${source}-${work.workId}`}
            work={work}
            source={source}
          />
        ))}
      </div>
    </section>
  );
}

export async function DoujinCompareRelatedWorksSection({
  workIds,
  titleA,
  titleB,
}: DoujinCompareRelatedWorksSectionProps) {
  const ids = workIds.map((id) => id.trim()).filter(Boolean).slice(0, 4);
  if (ids.length < 2) return null;

  const [multi, pairRelated] = await Promise.all([
    getDoujinMultiCompareSimilarWorks(ids, 12),
    ids.length >= 2
      ? getDoujinCompareRelatedWorks(ids[0], ids[1], 8)
      : Promise.resolve({ both: [], forA: [], forB: [] }),
  ]);

  const hasAny =
    multi.length > 0 ||
    pairRelated.both.length > 0 ||
    pairRelated.forA.length > 0 ||
    pairRelated.forB.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <RelatedSection
        heading={`この${ids.length}作品に似ている作品`}
        works={multi}
        source="multi"
      />
      {ids.length === 2 ? (
        <>
          <RelatedSection
            heading="この2作品の両方に似ている作品"
            works={pairRelated.both}
            source="both"
          />
          <RelatedSection
            heading={
              titleA
                ? `「${titleA.length > 24 ? `${titleA.slice(0, 24)}…` : titleA}」に似ている作品`
                : "作品Aに似ている作品"
            }
            works={pairRelated.forA}
            source="a"
          />
          <RelatedSection
            heading={
              titleB
                ? `「${titleB.length > 24 ? `${titleB.slice(0, 24)}…` : titleB}」に似ている作品`
                : "作品Bに似ている作品"
            }
            works={pairRelated.forB}
            source="b"
          />
        </>
      ) : null}
      <p className="mt-6 text-center text-sm">
        <Link href="/doujin/works" className="text-accent hover:underline">
          作品一覧から探す
        </Link>
      </p>
    </div>
  );
}
