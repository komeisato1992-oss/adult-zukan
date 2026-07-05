import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllMakers } from "@/data/makers";
import { getAllWorks } from "@/lib/works/repository";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { WorkThumbnail } from "@/components/ui/WorkThumbnail";

type MakerFeatureSectionProps = {
  id?: string;
};

export async function MakerFeatureSection({ id }: MakerFeatureSectionProps) {
  const makers = getAllMakers().slice(0, 4);
  const allWorks = await getAllWorks();

  return (
    <section aria-labelledby={id} className="mb-12">
      <SectionHeader title="メーカー特集" href="/makers" id={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        {makers.map((maker) => {
          const works = allWorks
            .filter((work) => work.makerSlug === maker.slug)
            .slice(0, 3);

          return (
            <article
              key={maker.slug}
              className="group overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-lg"
            >
              <div className="border-b border-border/60 bg-surface px-5 py-4">
                <h3 className="text-base font-bold text-foreground group-hover:text-accent">
                  <Link href={`/makers/${maker.slug}`}>{maker.name}</Link>
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {maker.description}
                </p>
              </div>
              <div className="flex gap-3 p-4">
                {works.map((work) => (
                  <a
                    key={work.slug}
                    href={work.affiliateUrl}
                    target="_blank"
                    rel={AFFILIATE_LINK_REL}
                    className="group/card relative aspect-[2/3] w-1/3 overflow-hidden rounded-md"
                  >
                    <WorkThumbnail title={work.title} variant="card" className="h-full" />
                  </a>
                ))}
              </div>
              <div className="px-5 pb-4">
                <Link
                  href={`/makers/${maker.slug}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {maker.name}の作品をもっと見る →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
