import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { PaginatedWorkListSection } from "@/components/works/PaginatedWorkListSection";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { toRankingJsonLdEntries } from "@/lib/ranking/work-card-item";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig } from "@/lib/site-config";
import {
  getPaginatedWorkCardListFromSorted,
} from "@/lib/works/paginated-work-list";
import {
  getPopularWorks,
  getSharedCatalogWorks,
} from "@/lib/works/catalog";

export const revalidate = 21600;

type RankingWorksPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ searchParams }: RankingWorksPageProps) {
  const { page } = await searchParams;
  const currentPage = parsePageParam(page);
  const pageSuffix = currentPage > 1 ? `（${currentPage}ページ目）` : "";

  return createPageMetadata({
    title: `人気作品ランキング${pageSuffix}`,
    description: "アダルト図鑑の人気作品ランキング。",
    path: "/ranking/works",
  });
}

export default async function RankingWorksPage({
  searchParams,
}: RankingWorksPageProps) {
  const { page } = await searchParams;
  const currentPage = parsePageParam(page);
  const catalog = await getSharedCatalogWorks();
  const rankedWorks = getPopularWorks(catalog, catalog.length);
  const list = getPaginatedWorkCardListFromSorted(rankedWorks, {
    page: currentPage,
  });
  const rankOffset = (list.currentPage - 1) * list.pageSize;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "人気作品", path: "/ranking/works" },
          ]),
          ...(list.currentPage === 1
            ? [
                createItemListJsonLd(
                  "人気作品ランキング",
                  toRankingJsonLdEntries(list.pageItems).map((entry) => ({
                    name: entry.name,
                    url: `${siteConfig.url}${entry.url}`,
                  })),
                ),
              ]
            : []),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "人気作品" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            人気作品ランキング
          </h1>
          <PageIntro text="視聴者の評価とアクセス数をもとに集計した人気作品ランキングです。" />
          {list.totalItems > 0 ? (
            <p className="mt-2 text-sm text-muted">
              {list.totalItems}件
              {list.totalPages > 1
                ? `（${list.currentPage}/${list.totalPages}ページ目）`
                : null}
            </p>
          ) : null}
        </header>
        <RankingNav current="/ranking/works" />
        <PaginatedWorkListSection
          pageItems={list.pageItems}
          currentPage={list.currentPage}
          totalPages={list.totalPages}
          basePath="/ranking/works"
          showSortNav={false}
          showRank
          rankOffset={rankOffset}
        />
      </PageLayout>
    </>
  );
}
