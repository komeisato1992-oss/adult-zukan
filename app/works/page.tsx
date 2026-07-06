import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { getWorksPageItems } from "@/lib/dmm/list-items";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";
import { filterItemsWithValidImage } from "@/lib/works";

export const revalidate = 86400;

type WorksPageProps = {
  searchParams: Promise<{
    q?: string;
    sale?: string;
    filter?: string;
    sort?: string;
  }>;
};

function isSaleFilter(params: { sale?: string; filter?: string }): boolean {
  return params.sale === "1" || params.filter === "sale";
}

export async function generateMetadata({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const { q } = params;

  if (q) {
    return createPageMetadata({
      title: `「${q}」の検索結果`,
      description: `「${q}」に一致するアダルト作品の検索結果一覧。${siteConfig.name}で作品情報を確認できます。`,
      path: `/works?q=${encodeURIComponent(q)}`,
      noIndex: true,
    });
  }

  if (isSaleFilter(params)) {
    return createPageMetadata({
      title: "セール作品一覧",
      description:
        "セール中のアダルト作品一覧。お得な価格の作品をチェックできます。",
      path: "/works?filter=sale",
    });
  }

  return createPageMetadata({
    title: "作品一覧",
    description: pageIntros.works,
    path: "/works",
  });
}

function getPageTitle(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
}) {
  if (params.q) return `「${params.q}」の検索結果`;
  if (isSaleFilter(params)) return "セール作品一覧";
  if (params.sort === "new") return "最新作品一覧";
  if (params.sort === "rank") return "ランキング順 作品一覧";
  return "作品一覧";
}

export default async function WorksPage({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const pageTitle = getPageTitle(params);
  const result = await getWorksPageItems(params);
  const items = result.success
    ? filterItemsWithValidImage(result.items)
    : [];

  return (
    <>
      {result.success && items.length > 0 && (
        <JsonLd
          data={[
            createBreadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: pageTitle, path: "/works" },
            ]),
            createItemListJsonLd(
              pageTitle,
              items.map((item) => ({
                name: item.title,
                url: `${siteConfig.url}/works/${item.content_id}`,
              })),
            ),
          ]}
        />
      )}
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: pageTitle }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {pageTitle}
          </h1>
          <PageIntro text={pageIntros.works} />
          {result.success ? (
            <p className="mt-2 text-sm text-muted">
              {items.length}件の作品が見つかりました。
            </p>
          ) : null}
        </header>

        {!result.success ? (
          <p className="rounded border border-border bg-surface p-8 text-center text-sm text-accent">
            {result.message}
          </p>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <DmmWorkListCard key={item.content_id} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
            該当する作品が見つかりませんでした。別のキーワードで検索してください。
          </p>
        )}
      </PageLayout>
    </>
  );
}
