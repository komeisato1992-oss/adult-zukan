import Link from "next/link";
import { CompareRelatedWorkCard } from "@/components/compare/CompareRelatedWorkCard";
import {
  getCompareRelatedWorks,
  type BothSimilarWorkCard,
} from "@/lib/compare/get-similar-works";
import { COMPARE_RELATED_GRID_CLASSNAME } from "@/components/works/work-list-grid";

type CompareRelatedWorksSectionProps = {
  contentIdA: string;
  contentIdB: string;
  titleA?: string;
  titleB?: string;
};

function RelatedSection({
  heading,
  works,
  source,
}: {
  heading: string;
  works: BothSimilarWorkCard[];
  source: "both" | "a" | "b";
}) {
  if (works.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
        {heading}
      </h2>
      <div className={`mt-4 ${COMPARE_RELATED_GRID_CLASSNAME}`}>
        {works.map((work) => (
          <CompareRelatedWorkCard
            key={`${source}-${work.contentId}`}
            work={work}
            source={source}
          />
        ))}
      </div>
    </section>
  );
}

export async function CompareRelatedWorksSection({
  contentIdA,
  contentIdB,
  titleA,
  titleB,
}: CompareRelatedWorksSectionProps) {
  const related = await getCompareRelatedWorks(contentIdA, contentIdB, 8);

  if (
    related.both.length === 0 &&
    related.forA.length === 0 &&
    related.forB.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-12 border-t border-border pt-8">
      <RelatedSection
        heading="この2作品の両方に似ている作品"
        works={related.both}
        source="both"
      />
      <RelatedSection
        heading={
          titleA
            ? `「${titleA.length > 24 ? `${titleA.slice(0, 24)}…` : titleA}」に似ている作品`
            : "作品Aに似ている作品"
        }
        works={related.forA}
        source="a"
      />
      <RelatedSection
        heading={
          titleB
            ? `「${titleB.length > 24 ? `${titleB.slice(0, 24)}…` : titleB}」に似ている作品`
            : "作品Bに似ている作品"
        }
        works={related.forB}
        source="b"
      />
      <p className="mt-6 text-center text-sm">
        <Link href="/works" className="text-accent hover:underline">
          作品一覧から探す
        </Link>
      </p>
    </div>
  );
}
