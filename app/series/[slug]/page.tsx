import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PaginatedWorkListSection } from "@/components/works/PaginatedWorkListSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBuildStaticGenerationLimit } from "@/lib/dmm/build-static";
import { getLimitedEncodedEntityStaticParams } from "@/lib/dmm/generate-static-params";
import { getSeriesSummaryBySlug, getSeriesWorksBySlug, getCatalogOrderMap } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
import { getPaginatedDisplayableWorkCardList } from "@/lib/works/paginated-work-list";
import { parseWorkSortParam } from "@/lib/works/sort";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createSeriesTitle } from "@/lib/seo/titles";
import {
  decodeEntitySlug,
  getMakerDetailPath,
  getSeriesDetailPath,
} from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

export const dynamic = "force-dynamic";

export const dynamicParams = true;

type SeriesDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

export async function generateStaticParams() {
  if (getBuildStaticGenerationLimit() === 0) return [];
  const { getSeriesSummaries } = await import("@/lib/catalog");
  const series = await getSeriesSummaries();
  return getLimitedEncodedEntityStaticParams(series.map((s) => s.slug));
}

export async function generateMetadata({
  params,
  searchParams,
}: SeriesDetailPageProps) {
  await searchParams;
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const series = await getSeriesSummaryBySlug(slug);

  if (!series) {
    return createPageMetadata({
      title: "シリーズが見つかりません",
      description: "指定されたシリーズは見つかりませんでした。",
      path: getSeriesDetailPath(rawSlug),
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createSeriesTitle(series.name),
    description: createListDescription({
      name: series.name,
      count: series.workCount,
      context: "シリーズの作品一覧",
    }),
    path: getSeriesDetailPath(series.slug),
    absoluteTitle: true,
  });
}

export default async function SeriesDetailPage({
  params,
  searchParams,
}: SeriesDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const { page, sort } = await searchParams;
  const series = await getSeriesSummaryBySlug(slug);

  if (!series) {
    notFound();
  }

  const works = await getSeriesWorksBySlug(slug);
  const currentSort = parseWorkSortParam(sort);
  const catalogOrder = await getCatalogOrderMap();
  const list = getPaginatedDisplayableWorkCardList(works, {
    page: parsePageParam(page),
    sort: currentSort,
    catalogOrder,
  });

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "シリーズ一覧", path: "/series" },
            { name: series.name, path: getSeriesDetailPath(series.slug) },
          ]),
          createCollectionPageJsonLd(
            `${series.name}シリーズ`,
            `${series.name}シリーズの作品一覧`,
            `${siteConfig.url}${getSeriesDetailPath(series.slug)}`,
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
                href={getMakerDetailPath(series.makerSlug)}
                className="text-accent hover:underline"
              >
                {series.makerName}
              </Link>
            </p>
          )}
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {series.name}シリーズ
          </h1>
          <p className="mt-2 text-sm text-muted">{series.workCount}件の作品</p>
        </header>

        <section aria-labelledby="series-all" className="mb-10">
          <SectionHeader title="全作品" id="series-all" />
          <PaginatedWorkListSection
            pageItems={list.pageItems}
            currentPage={list.currentPage}
            totalPages={list.totalPages}
            basePath={getSeriesDetailPath(slug)}
            currentSort={currentSort}
          />
        </section>

        {series.makerName && series.makerSlug && (
          <section aria-labelledby="series-maker" className="mb-10">
            <SectionHeader title="関連メーカー" id="series-maker" />
            <Link
              href={getMakerDetailPath(series.makerSlug)}
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
