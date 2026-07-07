import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCatalogSeriesStaticParams } from "@/lib/dmm/catalog-entities";
import { getSeriesSummaryBySlug, getSeriesWorksBySlug } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

type SeriesDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
  return getCatalogSeriesStaticParams();
}

export async function generateMetadata({ params }: SeriesDetailPageProps) {
  const { slug } = await params;
  const series = await getSeriesSummaryBySlug(slug);

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
    description: `${series.name}シリーズの作品一覧。${series.workCount}件の作品を掲載しています。`,
    path: `/series/${series.slug}`,
  });
}

export default async function SeriesDetailPage({
  params,
  searchParams,
}: SeriesDetailPageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  const series = await getSeriesSummaryBySlug(slug);

  if (!series) {
    notFound();
  }

  const works = await getSeriesWorksBySlug(slug);
  const currentPage = parsePageParam(page);

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
            works.slice(0, 24).map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.content_id}`,
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
          {series.makerName && series.makerSlug && (
            <p className="text-sm text-muted">
              メーカー:{" "}
              <Link
                href={`/makers/${series.makerSlug}`}
                className="text-accent hover:underline"
              >
                {series.makerName}
              </Link>
            </p>
          )}
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {series.name}シリーズ
          </h1>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        <section aria-labelledby="series-all" className="mb-10">
          <SectionHeader title="全作品" id="series-all" />
          <DmmCatalogWorksGrid
            items={works}
            currentPage={currentPage}
            paginationBasePath={`/series/${slug}`}
          />
        </section>

        {series.makerName && series.makerSlug && (
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
        )}
      </PageLayout>
    </>
  );
}
