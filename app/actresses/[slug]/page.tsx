import Image from "next/image";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCatalogActressStaticParams } from "@/lib/dmm/catalog-entities";
import {
  getActressSummaryBySlug,
  getActressWorksBySlug,
} from "@/lib/catalog";
import { getActressDetailPath } from "@/lib/actresses/slug";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createActressTitle } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
  createPersonJsonLd,
} from "@/lib/seo/json-ld";
import { getActressInternalLinks } from "@/lib/dmm/internal-links";
import { DmmRelatedWorks } from "@/components/works/DmmRelatedWorks";
import { isValidImageUrl } from "@/lib/works";

export const revalidate = 86400;

type ActressDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
  return getCatalogActressStaticParams();
}

export async function generateMetadata({ params }: ActressDetailPageProps) {
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
  const { page } = await searchParams;
  const actress = await getActressSummaryBySlug(slug);

  if (!actress) {
    notFound();
  }

  const works = await getActressWorksBySlug(slug);
  const { popularWorks, sameMakerWorks } = await getActressInternalLinks(slug);

  if (works.length === 0) {
    notFound();
  }

  const currentPage = parsePageParam(page);
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
            <p className="mt-2 text-sm text-muted">出演作品 {works.length}件</p>
          </div>
        </header>

        <section aria-labelledby="actress-works" className="mb-10">
          <SectionHeader title="出演作品" id="actress-works" />
          <DmmCatalogWorksGrid
            items={works}
            currentPage={currentPage}
            paginationBasePath={`/actresses/${slug}`}
          />
        </section>

        {popularWorks.length > 0 ? (
          <DmmRelatedWorks
            items={popularWorks}
            title="人気作品"
            sectionId="actress-popular"
          />
        ) : null}

        {sameMakerWorks.length > 0 ? (
          <DmmRelatedWorks
            items={sameMakerWorks}
            title="同メーカー作品"
            sectionId="actress-same-maker"
          />
        ) : null}
      </PageLayout>
    </>
  );
}
