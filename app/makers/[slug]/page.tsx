import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { ActressCard } from "@/components/ui/ActressCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllMakers, getMakerBySlug } from "@/data/makers";
import { getSeriesByMaker } from "@/data/series";
import { getLabelsByMaker } from "@/data/labels";
import {
  getWorksByMaker,
  getActressesForMaker,
} from "@/lib/works/repository";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type MakerDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllMakers().map((maker) => ({ slug: maker.slug }));
}

export async function generateMetadata({ params }: MakerDetailPageProps) {
  const { slug } = await params;
  const maker = getMakerBySlug(slug);

  if (!maker) {
    return createPageMetadata({
      title: "メーカーが見つかりません",
      description: "指定されたメーカーは見つかりませんでした。",
      path: `/makers/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${maker.name}の作品一覧`,
    description: maker.longDescription.slice(0, 120),
    path: `/makers/${maker.slug}`,
  });
}

export default async function MakerDetailPage({ params }: MakerDetailPageProps) {
  const { slug } = await params;
  const maker = getMakerBySlug(slug);

  if (!maker) {
    notFound();
  }

  const [works, actresses] = await Promise.all([
    getWorksByMaker(maker.slug),
    getActressesForMaker(maker.slug),
  ]);
  const popularWorks = [...works]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 8);
  const seriesList = getSeriesByMaker(maker.slug);
  const labels = getLabelsByMaker(maker.slug);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "メーカー一覧", path: "/makers" },
            { name: maker.name, path: `/makers/${maker.slug}` },
          ]),
          createItemListJsonLd(
            `${maker.name}の作品一覧`,
            works.map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.slug}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "メーカー一覧", href: "/makers" },
            { label: maker.name },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {maker.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {maker.longDescription}
          </p>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        {popularWorks.length > 0 && (
          <section aria-labelledby="maker-popular" className="mb-10">
            <SectionHeader title="人気作品" id="maker-popular" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {popularWorks.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          </section>
        )}

        {seriesList.length > 0 && (
          <section aria-labelledby="maker-series" className="mb-10">
            <SectionHeader title="代表シリーズ" id="maker-series" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {seriesList.map((series) => (
                <Link
                  key={series.slug}
                  href={`/series/${series.slug}`}
                  className="rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <p className="font-semibold text-foreground">{series.name}</p>
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {series.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {labels.length > 0 && (
          <section aria-labelledby="maker-labels" className="mb-10">
            <SectionHeader title="レーベル" id="maker-labels" href="/labels" />
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <Link
                  key={label.slug}
                  href={`/labels/${label.slug}`}
                  className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent"
                >
                  {label.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {actresses.length > 0 && (
          <section aria-labelledby="maker-actresses" className="mb-10">
            <SectionHeader title="出演女優" id="maker-actresses" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
              {actresses.slice(0, 10).map((actress) => (
                <ActressCard key={actress.slug} actress={actress} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="maker-all">
          <SectionHeader title="全作品" id="maker-all" />
          {works.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在、このメーカーの作品はありません。
              <Link href="/works" className="mt-2 block text-accent hover:underline">
                作品一覧を見る
              </Link>
            </p>
          )}
        </section>
      </PageLayout>
    </>
  );
}
