import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { ActressCard } from "@/components/ui/ActressCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllSeries, getSeriesBySlug } from "@/data/series";
import { getGenreBySlug } from "@/data/genres";
import {
  getWorksBySeries,
  getActressesForSeries,
} from "@/lib/works/repository";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type SeriesDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllSeries().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: SeriesDetailPageProps) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    return createPageMetadata({
      title: "シリーズが見つかりません",
      description: "指定されたシリーズは見つかりませんでした。",
      path: `/series/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${series.name}シリーズ`,
    description: series.longDescription.slice(0, 120),
    path: `/series/${series.slug}`,
  });
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  const [works, actresses] = await Promise.all([
    getWorksBySeries(series.slug),
    getActressesForSeries(series.slug),
  ]);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "シリーズ一覧", path: "/series" },
            { name: series.name, path: `/series/${series.slug}` },
          ]),
          createItemListJsonLd(
            `${series.name}シリーズ`,
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
            { label: "シリーズ一覧", href: "/series" },
            { label: series.name },
          ]}
        />
        <header className="mt-4 mb-6">
          <p className="text-sm text-muted">
            メーカー:{" "}
            <Link href={`/makers/${series.makerSlug}`} className="text-accent hover:underline">
              {series.makerName}
            </Link>
          </p>
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {series.name}シリーズ
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            {series.longDescription}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {series.genreSlugs.map((genreSlug) => {
              const genre = getGenreBySlug(genreSlug);
              return (
                <Link
                  key={genreSlug}
                  href={`/genres/${genreSlug}`}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  {genre?.name ?? genreSlug}
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        <section aria-labelledby="series-all" className="mb-10">
          <SectionHeader title="全作品" id="series-all" />
          {works.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在、このシリーズの作品はありません。
            </p>
          )}
        </section>

        <section aria-labelledby="series-maker" className="mb-10">
          <SectionHeader title="関連メーカー" id="series-maker" />
          <Link
            href={`/makers/${series.makerSlug}`}
            className="inline-flex rounded-lg border border-border bg-white px-6 py-4 transition-shadow hover:shadow-md"
          >
            <div>
              <p className="font-bold text-foreground">{series.makerName}</p>
              <p className="mt-1 text-sm text-accent">メーカー詳細を見る →</p>
            </div>
          </Link>
        </section>

        {actresses.length > 0 && (
          <section aria-labelledby="series-actresses">
            <SectionHeader title="関連女優" id="series-actresses" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
              {actresses.slice(0, 10).map((actress) => (
                <ActressCard key={actress.slug} actress={actress} />
              ))}
            </div>
          </section>
        )}
      </PageLayout>
    </>
  );
}
