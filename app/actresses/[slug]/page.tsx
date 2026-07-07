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
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
  createPersonJsonLd,
} from "@/lib/seo/json-ld";
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
    title: `${actress.name}の出演作品一覧`,
    description: `${actress.name}の出演作品を一覧で掲載。品番、メーカー、レーベル、価格、サンプル画像を確認できます。`,
    path: getActressDetailPath(actress.name),
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
          createItemListJsonLd(
            `${actress.name}の出演作品`,
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
            { label: "女優一覧", href: "/actresses" },
            { label: actress.name },
          ]}
        />

        <header className="mt-6 mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-border sm:h-48 sm:w-36">
            {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
              <Image
                src={actress.imageUrl}
                alt={actress.name}
                fill
                className="object-cover object-center"
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
          <SectionHeader title="出演作品一覧" id="actress-works" />
          <DmmCatalogWorksGrid
            items={works}
            currentPage={currentPage}
            paginationBasePath={`/actresses/${slug}`}
          />
        </section>
      </PageLayout>
    </>
  );
}
