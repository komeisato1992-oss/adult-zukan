import { PageLayout } from "@/components/layout/PageLayout";
import { WorkCard } from "@/components/ui/WorkCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAllWorks,
  getSaleWorks,
  searchWorks,
  getLatestWorks,
  getRankedWorks,
} from "@/lib/works/repository";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type WorksPageProps = {
  searchParams: Promise<{ q?: string; sale?: string; sort?: string }>;
};

export async function generateMetadata({ searchParams }: WorksPageProps) {
  const { q, sale } = await searchParams;

  if (q) {
    return createPageMetadata({
      title: `「${q}」の検索結果`,
      description: `「${q}」に一致するアダルト作品の検索結果一覧。${siteConfig.name}で作品情報を確認できます。`,
      path: `/works?q=${encodeURIComponent(q)}`,
      noIndex: true,
    });
  }

  if (sale === "1") {
    return createPageMetadata({
      title: "セール作品一覧",
      description:
        "セール中のアダルト作品一覧。お得な価格の作品をチェックできます。",
      path: "/works?sale=1",
    });
  }

  return createPageMetadata({
    title: "作品一覧",
    description: pageIntros.works,
    path: "/works",
  });
}

async function getFilteredWorks(params: {
  q?: string;
  sale?: string;
  sort?: string;
}) {
  if (params.q) return searchWorks(params.q);
  if (params.sale === "1") return getSaleWorks();
  if (params.sort === "new") return getLatestWorks();
  if (params.sort === "rank") return getRankedWorks();
  return getAllWorks();
}

function getPageTitle(params: { q?: string; sale?: string; sort?: string }) {
  if (params.q) return `「${params.q}」の検索結果`;
  if (params.sale === "1") return "セール作品一覧";
  if (params.sort === "new") return "最新作品一覧";
  if (params.sort === "rank") return "ランキング順 作品一覧";
  return "作品一覧";
}

export default async function WorksPage({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const works = await getFilteredWorks(params);
  const pageTitle = getPageTitle(params);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: pageTitle, path: "/works" },
          ]),
          createItemListJsonLd(
            pageTitle,
            works.map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.slug}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: pageTitle }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {pageTitle}
          </h1>
          <PageIntro text={pageIntros.works} />
          <p className="mt-2 text-sm text-muted">
            {works.length}件の作品が見つかりました。
          </p>
        </header>

        {works.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {works.map((work) => (
              <WorkCard key={work.slug} work={work} />
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
