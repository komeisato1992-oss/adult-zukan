import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SearchBar } from "@/components/ui/SearchBar";
import { Pagination } from "@/components/ui/Pagination";
import { PageIntro } from "@/components/ui/PageIntro";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { unifiedSearch } from "@/lib/search/unified";
import { parsePageParam } from "@/lib/pagination";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createSearchDescription, truncateDescription } from "@/lib/seo/descriptions";
import { createSearchResultTitle, seoTitles } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type SearchPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const trimmed = q?.trim();

  if (trimmed) {
    return createPageMetadata({
      title: createSearchResultTitle(trimmed),
      description: createSearchDescription(trimmed),
      path: `/search?q=${encodeURIComponent(trimmed)}`,
      noIndex: true,
      absoluteTitle: true,
    });
  }

  return createPageMetadata({
    title: seoTitles.search,
    description: truncateDescription(pageIntros.search),
    path: "/search",
    absoluteTitle: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams;
  const trimmed = q?.trim().replace(/[\s\u3000]+/g, " ");
  const currentPage = parsePageParam(page);
  const results = trimmed ? await unifiedSearch(trimmed, currentPage) : null;
  const items = results?.items ?? [];

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: trimmed ? `「${trimmed}」の検索結果` : "検索", path: "/search" },
          ]),
          ...(trimmed
            ? []
            : [
                createCollectionPageJsonLd(
                  "作品検索",
                  pageIntros.search,
                  `${siteConfig.url}/search`,
                ),
              ]),
          ...(results && items.length > 0
            ? [
                createItemListJsonLd(
                  `「${results.query}」の検索結果`,
                  items.map((item) => ({
                    name: item.title,
                    url: `${siteConfig.url}/works/${item.content_id}`,
                  })),
                ),
              ]
            : []),
        ]}
      />
      <PageLayout showSidebar={false}>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "検索" }]}
        />
        <header className="mt-4 mb-8">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {trimmed ? `「${trimmed}」の検索結果` : "作品検索"}
          </h1>
          <PageIntro text={pageIntros.search} />
        </header>

        <SearchBar defaultValue={trimmed ?? ""} className="mb-8 max-w-2xl" />

        {results ? (
          results.total > 0 ? (
            <div>
              <p className="mb-6 text-sm text-muted">
                「{results.query}」の検索結果：{results.total}件
                {results.totalPages > 1
                  ? `（${results.currentPage}/${results.totalPages}ページ目）`
                  : null}
              </p>
              <DmmCatalogWorksGrid items={items} />
              {results.totalPages > 1 ? (
                <Pagination
                  currentPage={results.currentPage}
                  totalPages={results.totalPages}
                  basePath="/search"
                  query={{ q: results.query }}
                />
              ) : null}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              「{results.query}」に一致する作品が見つかりませんでした。別のキーワードでお試しください。
            </p>
          )
        ) : (
          <p className="text-sm text-muted">
            作品名・品番・女優名・メーカー名・レーベル名・シリーズ名・ジャンル名で検索できます。
          </p>
        )}
      </PageLayout>
    </>
  );
}
