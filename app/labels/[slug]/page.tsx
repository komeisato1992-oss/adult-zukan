import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCatalogLabelStaticParams } from "@/lib/dmm/catalog-entities";
import { getLabelSummaryBySlug, getLabelWorksBySlug } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

type LabelDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
  return getCatalogLabelStaticParams();
}

export async function generateMetadata({ params }: LabelDetailPageProps) {
  const { slug } = await params;
  const label = await getLabelSummaryBySlug(slug);

  if (!label) {
    return createPageMetadata({
      title: "レーベルが見つかりません",
      description: "指定されたレーベルは見つかりませんでした。",
      path: `/labels/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${label.name}レーベルの作品一覧`,
    description: `${label.name}レーベルの作品一覧。${label.workCount}件の作品を掲載しています。`,
    path: `/labels/${label.slug}`,
  });
}

export default async function LabelDetailPage({
  params,
  searchParams,
}: LabelDetailPageProps) {
  const { slug } = await params;
  const { page } = await searchParams;
  const label = await getLabelSummaryBySlug(slug);

  if (!label) {
    notFound();
  }

  const works = await getLabelWorksBySlug(slug);
  const currentPage = parsePageParam(page);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "レーベル一覧", path: "/labels" },
            { name: label.name, path: `/labels/${label.slug}` },
          ]),
          createItemListJsonLd(
            `${label.name}レーベルの作品一覧`,
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
            { label: "レーベル一覧", href: "/labels" },
            { label: label.name },
          ]}
        />
        <header className="mt-4 mb-6">
          {label.makerName && label.makerSlug && (
            <p className="text-sm text-muted">
              メーカー:{" "}
              <Link
                href={`/makers/${label.makerSlug}`}
                className="text-accent hover:underline"
              >
                {label.makerName}
              </Link>
            </p>
          )}
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {label.name}
          </h1>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        <section aria-labelledby="label-all">
          <SectionHeader title="全作品" id="label-all" />
          <DmmCatalogWorksGrid
            items={works}
            currentPage={currentPage}
            paginationBasePath={`/labels/${slug}`}
          />
        </section>
      </PageLayout>
    </>
  );
}
