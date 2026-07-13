import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PaginatedWorkListSection } from "@/components/works/PaginatedWorkListSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBuildStaticGenerationLimit } from "@/lib/dmm/build-static";
import { getLimitedEncodedEntityStaticParams } from "@/lib/dmm/generate-static-params";
import { getGenreSummaryBySlug, getGenreWorksBySlug, getCatalogOrderMap } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
import { getPaginatedDisplayableWorkCardList } from "@/lib/works/paginated-work-list";
import { parseWorkSortParam } from "@/lib/works/sort";
import { siteConfig } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createGenreTitle } from "@/lib/seo/titles";
import { decodeEntitySlug, getGenreDetailPath } from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

export const dynamicParams = true;

type GenreDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

export async function generateStaticParams() {
  if (getBuildStaticGenerationLimit() === 0) return [];
  const { getGenreSummaries } = await import("@/lib/catalog");
  const genres = await getGenreSummaries();
  return getLimitedEncodedEntityStaticParams(genres.map((g) => g.slug));
}

export async function generateMetadata({
  params,
  searchParams,
}: GenreDetailPageProps) {
  await searchParams;
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const genre = await getGenreSummaryBySlug(slug);

  if (!genre) {
    return createPageMetadata({
      title: "ジャンルが見つかりません",
      description: "指定されたジャンルは見つかりませんでした。",
      path: getGenreDetailPath(rawSlug),
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createGenreTitle(genre.name),
    description: createListDescription({
      name: genre.name,
      count: genre.workCount,
      context: "ジャンルの人気作品一覧",
    }),
    path: getGenreDetailPath(genre.slug),
    absoluteTitle: true,
  });
}

export default async function GenreDetailPage({
  params,
  searchParams,
}: GenreDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const { page, sort } = await searchParams;
  const genre = await getGenreSummaryBySlug(slug);

  if (!genre) {
    notFound();
  }

  const works = await getGenreWorksBySlug(slug);
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
            { name: "ジャンル一覧", path: "/genres" },
            { name: genre.name, path: getGenreDetailPath(genre.slug) },
          ]),
          createCollectionPageJsonLd(
            `${genre.name}の作品一覧`,
            `${genre.name}ジャンルの作品一覧`,
            `${siteConfig.url}${getGenreDetailPath(genre.slug)}`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ジャンル一覧", href: "/genres" },
            { label: genre.name },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {genre.name}
          </h1>
          <p className="mt-2 text-sm text-muted">{genre.workCount}件の作品</p>
          <PageIntro
            text={`${genre.name}ジャンルの作品を一覧掲載。人気作品からお好みの作品を探せます。`}
          />
        </header>

        <section aria-labelledby="genre-all">
          <SectionHeader title="全作品" id="genre-all" />
          {list.totalItems > 0 ? (
            <PaginatedWorkListSection
              pageItems={list.pageItems}
              currentPage={list.currentPage}
              totalPages={list.totalPages}
              basePath={getGenreDetailPath(slug)}
              currentSort={currentSort}
            />
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在掲載中の作品はありません。
            </p>
          )}
        </section>
      </PageLayout>
    </>
  );
}
