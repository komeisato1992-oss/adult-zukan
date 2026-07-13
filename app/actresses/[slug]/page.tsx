import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ActressGenreLinks } from "@/components/actresses/ActressGenreLinks";
import { ActressLatestWork } from "@/components/actresses/ActressLatestWork";
import { ActressPopularWorks } from "@/components/actresses/ActressPopularWorks";
import { ActressSeriesLinks } from "@/components/actresses/ActressSeriesLinks";
import { ActressPaginatedWorks } from "@/components/actresses/ActressPaginatedWorks";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBuildStaticGenerationLimit } from "@/lib/dmm/build-static";
import { getLimitedSlugStaticParams } from "@/lib/dmm/generate-static-params";
import {
  getActressSummaryBySlug,
  getActressWorksBySlug,
  getCatalogOrderMap,
} from "@/lib/catalog";
import { getActressDetailPath } from "@/lib/actresses/slug";
import { buildActressPageSections } from "@/lib/dmm/actress-page";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getDmmItemMakerName } from "@/lib/dmm/display";
import { parsePageParam } from "@/lib/pagination";
import { getPaginatedWorkCardList } from "@/lib/works/paginated-work-list";
import { parseWorkSortParam } from "@/lib/works/sort";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createActressTitle } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
  createPersonJsonLd,
} from "@/lib/seo/json-ld";
import { isValidImageUrl } from "@/lib/works";

export const revalidate = 86400;

export const dynamicParams = true;

type ActressDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string; maker?: string }>;
};

export async function generateStaticParams() {
  if (getBuildStaticGenerationLimit() === 0) return [];
  const { getActressSummaries } = await import("@/lib/catalog");
  const actresses = await getActressSummaries();
  return getLimitedSlugStaticParams(actresses.map((a) => a.slug));
}

export async function generateMetadata({
  params,
  searchParams,
}: ActressDetailPageProps) {
  await searchParams;
  const { slug } = await params;
  const actress = await getActressSummaryBySlug(slug);

  if (!actress) {
    return createPageMetadata({
      title: "女優が見つかりません",
      description: "指定された女優は見つかりませんでした。",
      path: `/actresses/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createActressTitle(actress.name),
    description: createListDescription({
      name: actress.name,
      count: actress.workCount,
      context: "の出演作品一覧",
    }),
    path: getActressDetailPath(actress.name),
    absoluteTitle: true,
    ogImage: actress.imageUrl,
  });
}

export default async function ActressDetailPage({
  params,
  searchParams,
}: ActressDetailPageProps) {
  const { slug } = await params;
  const { page, sort, maker } = await searchParams;
  const actress = await getActressSummaryBySlug(slug);

  if (!actress) {
    notFound();
  }

  const works = await getActressWorksBySlug(slug);
  const displayableWorks = filterDisplayableItems(works);
  const sections = buildActressPageSections(works);

  if (displayableWorks.length === 0) {
    notFound();
  }

  const selectedMaker = maker?.trim() || undefined;
  const filteredWorks =
    selectedMaker != null
      ? displayableWorks.filter(
          (item) => getDmmItemMakerName(item) === selectedMaker,
        )
      : displayableWorks;
  const currentSort = parseWorkSortParam(sort);
  const catalogOrder = await getCatalogOrderMap();
  const list = getPaginatedWorkCardList(filteredWorks, {
    page: parsePageParam(page),
    sort: currentSort,
    catalogOrder,
  });
  const actressUrl = `${siteConfig.url}${getActressDetailPath(actress.name)}`;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "女優一覧", path: "/actresses" },
            { name: actress.name, path: getActressDetailPath(actress.name) },
          ]),
          createPersonJsonLd(
            actress.name,
            `${actress.name}の出演作品一覧`,
            actressUrl,
          ),
          createCollectionPageJsonLd(
            `${actress.name}の出演作品一覧`,
            `${actress.name}の出演作品を一覧掲載`,
            actressUrl,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "女優一覧", href: "/actresses" },
            { label: actress.name },
          ]}
        />

        <header className="mt-6 mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface sm:h-48 sm:w-36">
            {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
              <Image
                src={actress.imageUrl}
                alt={actress.name}
                fill
                className="object-cover object-[right_center]"
                sizes="144px"
                loading="lazy"
                unoptimized
              />
            ) : null}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {actress.name}
            </h1>
            <p className="mt-3 text-sm text-muted">当サイト掲載作品数</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {sections.catalogWorkCount}作品
            </p>
          </div>
        </header>

        {sections.latestWork ? (
          <ActressLatestWork item={sections.latestWork} />
        ) : null}

        <ActressPopularWorks items={sections.popularWorks} />

        <Suspense fallback={null}>
          <ActressPaginatedWorks
            slug={slug}
            makers={sections.makers}
            selectedMaker={selectedMaker}
            currentSort={currentSort}
            list={list}
          />
        </Suspense>

        <ActressGenreLinks genres={sections.genres} />

        <ActressSeriesLinks series={sections.series} />
      </PageLayout>
    </>
  );
}
