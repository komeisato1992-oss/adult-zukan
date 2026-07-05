import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SearchBar } from "@/components/ui/SearchBar";
import { WorkCard } from "@/components/ui/WorkCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { unifiedSearch } from "@/lib/search/unified";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
  createWebsiteJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  if (q) {
    return createPageMetadata({
      title: `「${q}」の検索結果`,
      description: `「${q}」に一致する作品・女優・メーカー・シリーズ・ジャンルの検索結果。`,
      path: `/search?q=${encodeURIComponent(q)}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: "作品検索",
    description: pageIntros.search,
    path: "/search",
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const results = q ? await unifiedSearch(q) : null;

  return (
    <>
      <JsonLd
        data={[
          createWebsiteJsonLd(),
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "検索", path: "/search" },
          ]),
          ...(results && results.works.length > 0
            ? [
                createItemListJsonLd(
                  q ? `「${q}」の検索結果` : "検索結果",
                  results.works.slice(0, 20).map((work) => ({
                    name: work.title,
                    url: `${siteConfig.url}/works/${work.slug}`,
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
            {q ? `「${q}」の検索結果` : "作品検索"}
          </h1>
          <PageIntro text={pageIntros.search} />
        </header>

        <SearchBar defaultValue={q ?? ""} className="mb-8 max-w-2xl" />

        {results ? (
          results.total > 0 ? (
            <div className="space-y-10">
              <p className="text-sm text-muted">{results.total}件の結果が見つかりました。</p>

              {results.works.length > 0 && (
                <section aria-labelledby="search-works">
                  <h2 id="search-works" className="mb-4 text-lg font-bold text-foreground">
                    作品（{results.works.length}件）
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {results.works.map((work) => (
                      <WorkCard key={work.slug} work={work} />
                    ))}
                  </div>
                </section>
              )}

              {results.actresses.length > 0 && (
                <section aria-labelledby="search-actresses">
                  <h2 id="search-actresses" className="mb-4 text-lg font-bold text-foreground">
                    女優（{results.actresses.length}件）
                  </h2>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {results.actresses.map((actress) => (
                      <li key={actress.slug}>
                        <Link
                          href={`/actresses/${actress.slug}`}
                          className="block px-4 py-3 text-sm hover:bg-surface"
                        >
                          {actress.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.makers.length > 0 && (
                <section aria-labelledby="search-makers">
                  <h2 id="search-makers" className="mb-4 text-lg font-bold text-foreground">
                    メーカー（{results.makers.length}件）
                  </h2>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {results.makers.map((maker) => (
                      <li key={maker.slug}>
                        <Link
                          href={`/makers/${maker.slug}`}
                          className="block px-4 py-3 text-sm hover:bg-surface"
                        >
                          {maker.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.series.length > 0 && (
                <section aria-labelledby="search-series">
                  <h2 id="search-series" className="mb-4 text-lg font-bold text-foreground">
                    シリーズ（{results.series.length}件）
                  </h2>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {results.series.map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/series/${s.slug}`}
                          className="block px-4 py-3 text-sm hover:bg-surface"
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.genres.length > 0 && (
                <section aria-labelledby="search-genres">
                  <h2 id="search-genres" className="mb-4 text-lg font-bold text-foreground">
                    ジャンル（{results.genres.length}件）
                  </h2>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {results.genres.map((genre) => (
                      <li key={genre.slug}>
                        <Link
                          href={`/genres/${genre.slug}`}
                          className="block px-4 py-3 text-sm hover:bg-surface"
                        >
                          {genre.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              「{q}」に一致する結果が見つかりませんでした。別のキーワードでお試しください。
            </p>
          )
        ) : (
          <p className="text-sm text-muted">
            作品名・品番・女優名・メーカー名・シリーズ名・ジャンル名で検索できます。
          </p>
        )}
      </PageLayout>
    </>
  );
}
