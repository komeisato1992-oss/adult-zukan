import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { Pagination } from "@/components/ui/Pagination";
import { DmmWorkListCard } from "@/components/works/DmmWorkListCard";
import { WorksSortNav } from "@/components/works/WorksSortNav";
import { PageIntro } from "@/components/ui/PageIntro";
import { getCatalogWorks } from "@/lib/catalog";
import { getWorksPageItems } from "@/lib/dmm/list-items";
import { filterValidListItems } from "@/lib/dmm/filter";
import {
  paginateItems,
  parsePageParam,
  WORKS_LIST_PAGE_SIZE,
} from "@/lib/pagination";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";
import {
  DEFAULT_WORK_SORT,
  getWorksSortOptions,
  getWorksSortPageTitle,
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
  }>;
};

function isSaleFilter(params: { sale?: string; filter?: string }): boolean {
  return params.sale === "1" || params.filter === "sale";
}

function getWorksQueryParams(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
}) {
  const sort = parseWorkSortParam(params.sort);
  return {
    q: params.q,
    sale: params.sale,
    filter: params.filter,
    sort: sort === DEFAULT_WORK_SORT ? undefined : sort,
  };
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

  const sortTitle = getWorksSortPageTitle(parseWorkSortParam(params.sort));
  if (sortTitle) {
    return createPageMetadata({
      title: sortTitle,
      description: pageIntros.works,
      path: `/works?sort=${parseWorkSortParam(params.sort)}`,
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
  const sortTitle = getWorksSortPageTitle(parseWorkSortParam(params.sort));
  if (sortTitle) return sortTitle;
  return "作品一覧";
}

export default async function WorksPage({ searchParams }: WorksPageProps) {
  const params = await searchParams;
  const currentSort = parseWorkSortParam(params.sort);
  const pageTitle = getPageTitle(params);
  const currentPage = parsePageParam(params.page);
  const queryParams = getWorksQueryParams(params);
  const [result, catalog] = await Promise.all([
    getWorksPageItems(params),
    getCatalogWorks(),
  ]);
  const sortOptions = getWorksSortOptions(catalog);
  const allItems = result.success ? filterValidListItems(result.items) : [];
  const pagination = paginateItems(allItems, currentPage, WORKS_LIST_PAGE_SIZE);
  const items = pagination.items;

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
        </header>

        <WorksSortNav
          currentSort={currentSort}
          options={sortOptions}
          query={{
            q: params.q,
            sale: params.sale,
            filter: params.filter,
          }}
        />

        {result.success ? (
          <p className="mb-6 text-sm text-muted">
            {pagination.totalItems}件の作品が見つかりました。
            {pagination.totalPages > 1
              ? `（${pagination.currentPage}/${pagination.totalPages}ページ目）`
              : null}
          </p>
        ) : null}

        {!result.success ? (
          <p className="rounded border border-border bg-surface p-8 text-center text-sm text-accent">
            {result.message}
          </p>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <DmmWorkListCard key={item.content_id} item={item} />
              ))}
            </div>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              basePath="/works"
              query={queryParams}
            />
          </>
        ) : (
          <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
            該当する作品が見つかりませんでした。別のキーワードで検索してください。
          </p>
        )}
      </PageLayout>
    </>
  );
}
