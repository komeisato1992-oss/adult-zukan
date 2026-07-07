import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCatalogGenreStaticParams } from "@/lib/dmm/catalog-entities";
import { getGenreSummaryBySlug, getGenreWorksBySlug } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
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

type GenreDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
  return getCatalogGenreStaticParams();
}

export async function generateMetadata({ params }: GenreDetailPageProps) {
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
  const { page } = await searchParams;
  const genre = await getGenreSummaryBySlug(slug);

  if (!genre) {
    notFound();
  }

  const works = await getGenreWorksBySlug(slug);
  const currentPage = parsePageParam(page);

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
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
          <PageIntro
            text={`${genre.name}ジャンルの作品を一覧掲載。人気作品からお好みの作品を探せます。`}
          />
        </header>

        <section aria-labelledby="genre-all">
          <SectionHeader title="全作品" id="genre-all" />
          <DmmCatalogWorksGrid
            items={works}
            currentPage={currentPage}
            paginationBasePath={getGenreDetailPath(slug)}
          />
        </section>
      </PageLayout>
    </>
  );
}
