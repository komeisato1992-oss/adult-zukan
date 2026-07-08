import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CatalogWorksListSection } from "@/components/works/CatalogWorksListSection";
import { DmmRelatedWorks } from "@/components/works/DmmRelatedWorks";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogMakerStaticParams,
} from "@/lib/dmm/catalog-entities";
import {
  getMakerSummaryBySlug,
  getMakerWorksBySlug,
} from "@/lib/catalog";
import {
  decodeEntitySlug,
  getMakerDetailPath,
  getSeriesDetailPath,
} from "@/lib/entities/paths";
import { getActressDetailPath } from "@/lib/actresses/slug";
import { getMakerInternalLinks } from "@/lib/dmm/internal-links";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createMakerTitle } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

type MakerDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
  return getCatalogMakerStaticParams();
}

export async function generateMetadata({ params }: MakerDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const maker = await getMakerSummaryBySlug(slug);

  if (!maker) {
    return createPageMetadata({
      title: "メーカーが見つかりません",
      description: "指定されたメーカーは見つかりませんでした。",
      path: getMakerDetailPath(rawSlug),
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createMakerTitle(maker.name),
    description: createListDescription({
      name: maker.name,
      count: maker.workCount,
      context: "の人気作品一覧",
    }),
    path: getMakerDetailPath(maker.slug),
    absoluteTitle: true,
  });
}

export default async function MakerDetailPage({
  params,
  searchParams,
}: MakerDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const { page } = await searchParams;
  const maker = await getMakerSummaryBySlug(slug);

  if (!maker) {
    notFound();
  }

  const works = await getMakerWorksBySlug(slug);
  const { popularWorks, topSeries, topActresses } =
    await getMakerInternalLinks(slug);
  const currentPage = parsePageParam(page);
  const makerUrl = `${siteConfig.url}${getMakerDetailPath(maker.slug)}`;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "メーカー一覧", path: "/makers" },
            { name: maker.name, path: getMakerDetailPath(maker.slug) },
          ]),
          createCollectionPageJsonLd(
            `${maker.name}の作品一覧`,
            `${maker.name}の作品を一覧掲載`,
            makerUrl,
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
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        {popularWorks.length > 0 ? (
          <DmmRelatedWorks
            items={popularWorks}
            title="人気作品"
            sectionId="maker-popular"
          />
        ) : null}

        {topSeries.length > 0 ? (
          <section aria-labelledby="maker-series" className="mt-12">
            <SectionHeader title="代表シリーズ" id="maker-series" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topSeries.map((series) => (
                <Link
                  key={series.slug}
                  href={getSeriesDetailPath(series.slug)}
                  className="rounded border border-border bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <h3 className="text-sm font-bold text-foreground">
                    {series.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {series.workCount}作品
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {topActresses.length > 0 ? (
          <section aria-labelledby="maker-actresses" className="mt-12">
            <SectionHeader title="人気女優" id="maker-actresses" />
            <div className="flex flex-wrap gap-2">
              {topActresses.map((actress) => (
                <Link
                  key={actress.slug}
                  href={getActressDetailPath(actress.name)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  {actress.name}（{actress.workCount}）
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="maker-all" className="mt-12">
          <SectionHeader title="全作品" id="maker-all" />
          {works.length > 0 ? (
            <CatalogWorksListSection
              items={works}
              initialPage={currentPage}
              paginationBasePath={getMakerDetailPath(slug)}
            />
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
