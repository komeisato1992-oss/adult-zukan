import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogItems,
  getCatalogMakerStaticParams,
  getCatalogMakers,
  getCatalogWorksByMakerSlug,
} from "@/lib/dmm/catalog-entities";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

type MakerDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getCatalogMakerStaticParams();
}

export async function generateMetadata({ params }: MakerDetailPageProps) {
  const { slug } = await params;
  const items = await getCatalogItems();
  const maker = getCatalogMakers(items).find((entry) => entry.slug === slug);

  if (!maker) {
    return createPageMetadata({
      title: "メーカーが見つかりません",
      description: "指定されたメーカーは見つかりませんでした。",
      path: `/makers/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${maker.name}の作品一覧`,
    description: `${maker.name}の作品一覧。${maker.workCount}件の作品を掲載しています。`,
    path: `/makers/${maker.slug}`,
  });
}

export default async function MakerDetailPage({ params }: MakerDetailPageProps) {
  const { slug } = await params;
  const items = await getCatalogItems();
  const maker = getCatalogMakers(items).find((entry) => entry.slug === slug);

  if (!maker) {
    notFound();
  }

  const works = getCatalogWorksByMakerSlug(items, slug);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "メーカー一覧", path: "/makers" },
            { name: maker.name, path: `/makers/${maker.slug}` },
          ]),
          createItemListJsonLd(
            `${maker.name}の作品一覧`,
            works.map((work) => ({
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

        <section aria-labelledby="maker-all">
          <SectionHeader title="全作品" id="maker-all" />
          {works.length > 0 ? (
            <DmmCatalogWorksGrid items={works} />
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
