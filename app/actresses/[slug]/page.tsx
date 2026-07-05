import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { ActressCard } from "@/components/ui/ActressCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { PersonImagePlaceholder } from "@/components/ui/PersonImagePlaceholder";
import {
  getAllActresses,
  getActressBySlug,
  getRelatedActresses,
} from "@/data/actresses";
import {
  getWorksByActress,
  getPopularWorksForActress,
} from "@/lib/works/repository";
import { getSeriesBySlug } from "@/data/series";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createPersonJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type ActressDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllActresses().map((actress) => ({ slug: actress.slug }));
}

export async function generateMetadata({ params }: ActressDetailPageProps) {
  const { slug } = await params;
  const actress = getActressBySlug(slug);

  if (!actress) {
    return createPageMetadata({
      title: "女優が見つかりません",
      description: "指定された女優は見つかりませんでした。",
      path: `/actresses/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${actress.name}の出演作品一覧`,
    description: actress.profile.slice(0, 120),
    path: `/actresses/${actress.slug}`,
  });
}

export default async function ActressDetailPage({
  params,
}: ActressDetailPageProps) {
  const { slug } = await params;
  const actress = getActressBySlug(slug);

  if (!actress) {
    notFound();
  }

  const [works, popularWorks] = await Promise.all([
    getWorksByActress(actress.slug),
    getPopularWorksForActress(actress.slug, 8),
  ]);
  const relatedActresses = getRelatedActresses(actress.slug);
  const actressUrl = `${siteConfig.url}/actresses/${actress.slug}`;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "女優一覧", path: "/actresses" },
            { name: actress.name, path: `/actresses/${actress.slug}` },
          ]),
          createPersonJsonLd(actress.name, actress.profile, actressUrl),
          createItemListJsonLd(
            `${actress.name}の出演作品`,
            works.map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.slug}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "女優一覧", href: "/actresses" },
            { label: actress.name },
          ]}
        />

        <header className="mt-6 mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-border sm:h-48 sm:w-36">
            <PersonImagePlaceholder name={actress.name} className="h-full" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {actress.name}
            </h1>
            <p className="mt-2 text-sm text-muted">デビュー: {actress.debutYear}年</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {actress.profile}
            </p>
            <p className="mt-2 text-sm text-muted">出演作品 {works.length}件</p>
          </div>
        </header>

        {actress.representativeSeriesSlugs.length > 0 && (
          <section aria-labelledby="actress-series" className="mb-10">
            <SectionHeader title="代表シリーズ" id="actress-series" href="/series" />
            <div className="grid gap-3 sm:grid-cols-2">
              {actress.representativeSeriesSlugs.map((seriesSlug) => {
                const series = getSeriesBySlug(seriesSlug);
                if (!series) return null;
                return (
                  <Link
                    key={seriesSlug}
                    href={`/series/${series.slug}`}
                    className="rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <p className="font-semibold text-foreground">{series.name}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">
                      {series.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {popularWorks.length > 0 && (
          <section aria-labelledby="actress-popular" className="mb-10">
            <SectionHeader title="人気作品" id="actress-popular" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {popularWorks.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="actress-works" className="mb-10">
          <SectionHeader title="出演作品一覧" id="actress-works" />
          {works.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在、この女優の出演作品はありません。
            </p>
          )}
        </section>

        {relatedActresses.length > 0 && (
          <section aria-labelledby="related-actresses" className="mb-10">
            <SectionHeader title="関連女優" id="related-actresses" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {relatedActresses.map((related) => (
                <ActressCard key={related.slug} actress={related} />
              ))}
            </div>
          </section>
        )}

        {actress.relatedArticles.length > 0 && (
          <section aria-labelledby="related-articles">
            <SectionHeader title="関連記事" id="related-articles" />
            <div className="grid gap-4 sm:grid-cols-2">
              {actress.relatedArticles.map((article) => (
                <Link
                  key={article.href}
                  href={article.href}
                  className="rounded-lg border border-border bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold text-foreground">{article.title}</h3>
                  <p className="mt-2 text-sm text-muted">{article.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </PageLayout>
    </>
  );
}
