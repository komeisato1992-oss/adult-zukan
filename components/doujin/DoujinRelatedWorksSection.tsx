import Link from "next/link";
import { DoujinSectionHeading } from "@/components/doujin/DoujinSectionHeading";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import type { DoujinWork } from "@/lib/doujin/types";

type DoujinRelatedWorksSectionProps = {
  title: string;
  sectionId: string;
  works: DoujinWork[];
  moreHref?: string;
  moreLabel?: string;
};

/** アダルト図鑑 DmmRelatedWorks 相当のセクション見出し＋同人カードグリッド */
export function DoujinRelatedWorksSection({
  title,
  sectionId,
  works,
  moreHref,
  moreLabel = "もっと見る",
}: DoujinRelatedWorksSectionProps) {
  if (works.length === 0) return null;

  const headingId = `${sectionId}-title`;

  return (
    <section aria-labelledby={headingId} className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-4">
        <DoujinSectionHeading title={title} id={headingId} className="" />
        {moreHref ? (
          <Link
            href={moreHref}
            className="shrink-0 text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            {moreLabel} →
          </Link>
        ) : null}
      </div>
      <DoujinWorksGrid works={works} />
    </section>
  );
}
