import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { WorksListSection } from "@/components/works/WorksListSection";
import { PageIntro } from "@/components/ui/PageIntro";
import { getCatalogWorks } from "@/lib/catalog";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";
import {
  getWorksSortPageTitle,
  getWorksCanonicalPath,
  parseWorkSortParam,
} from "@/lib/works/sort";

export const revalidate = 86400;

type WorksPageProps = {
  searchParams: Promise<{
    q?: string;
    sale?: string;
    filter?: string;
    sort?: string;
    page?: string;
    genre?: string;
    maker?: string;
    price?: string;
    date?: string;
  }>;
};

function isSaleFilter(params: { sale?: string; filter?: string }): boolean {
  return (
    params.sale === "1" ||
    params.sale === "true" ||
    params.filter === "sale"
  );
}

export async function generateMetadata({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const { q } = params;
  const sort = parseWorkSortParam(params.sort);
  const sortTitle = getWorksSortPageTitle(sort);

  return createPageMetadata({
    title: q
      ? `「${q}」の検索結果`
      : sortTitle
        ? `${sortTitle}｜AV作品一覧`
        : isSaleFilter(params)
          ? "セール作品一覧｜人気・新作・セール作品"
          : seoTitles.works,
    description: q
      ? truncateDescription(`「${q}」に一致するアダルト作品の検索結果一覧。`)
      : isSaleFilter(params)
        ? truncateDescription(
            "セール中のアダルト作品一覧。お得な価格の作品をチェックできます。",
          )
        : truncateDescription(pageIntros.works),
    path: "/works",
    canonicalPath: getWorksCanonicalPath(sort, "/works"),
    absoluteTitle: true,
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
  const sortTitle = getWorksSortPageTitle(parseWorkSortParam(params.sort));
  if (sortTitle) return sortTitle;
  return "作品一覧";
}

export default async function WorksPage({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const pageTitle = getPageTitle(params);
  const catalog = await getCatalogWorks();
  const displayableItems = filterDisplayableItems(catalog);

  return (
    <>
      {displayableItems.length > 0 && (
        <JsonLd
          data={[
            createBreadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: pageTitle, path: "/works" },
            ]),
            createCollectionPageJsonLd(
              pageTitle,
              pageIntros.works,
              `${siteConfig.url}/works`,
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
        </header>
        <WorksListSection items={displayableItems} />
      </PageLayout>
    </>
  );
}
