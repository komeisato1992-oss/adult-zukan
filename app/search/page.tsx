import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SearchBar } from "@/components/ui/SearchBar";
import { PageIntro } from "@/components/ui/PageIntro";
import { CatalogWorksListSection } from "@/components/works/CatalogWorksListSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { unifiedSearchAll } from "@/lib/search/unified";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createSearchDescription, truncateDescription } from "@/lib/seo/descriptions";
import { createSearchResultTitle, seoTitles } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";
import { parseWorkSortParam, getWorksCanonicalPath } from "@/lib/works/sort";

export const revalidate = 3600;

type SearchPageProps = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q, sort } = await searchParams;
  const trimmed = q?.trim();
  const parsedSort = parseWorkSortParam(sort);

  if (trimmed) {
    return createPageMetadata({
      title: createSearchResultTitle(trimmed),
      description: createSearchDescription(trimmed),
      path: `/search?q=${encodeURIComponent(trimmed)}`,
      canonicalPath: getWorksCanonicalPath(parsedSort, `/search?q=${encodeURIComponent(trimmed)}`),
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
  const { q } = await searchParams;
  const trimmed = q?.trim().replace(/[\s\u3000]+/g, " ");
  const results = trimmed ? await unifiedSearchAll(trimmed) : null;

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
          results.items.length > 0 ? (
            <div>
              <p className="mb-6 text-sm text-muted">
                「{results.query}」の検索結果：{results.items.length}件
              </p>
              <CatalogWorksListSection
                items={results.items}
                paginationBasePath="/search"
                query={{ q: results.query }}
              />
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
