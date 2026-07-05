import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllGenres, getGenreBySlug } from "@/data/genres";
import {
  getWorksByGenre,
  getPopularWorksByGenre,
  getLatestWorks,
} from "@/lib/works/repository";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type GenreDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllGenres().map((genre) => ({ slug: genre.slug }));
}

export async function generateMetadata({ params }: GenreDetailPageProps) {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);

  if (!genre) {
    return createPageMetadata({
      title: "ジャンルが見つかりません",
      description: "指定されたジャンルは見つかりませんでした。",
      path: `/genres/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${genre.name}の作品一覧`,
    description: genre.longDescription.slice(0, 120),
    path: `/genres/${genre.slug}`,
  });
}

export default async function GenreDetailPage({ params }: GenreDetailPageProps) {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);

  if (!genre) {
    notFound();
  }

  const [works, popularWorks, allLatest] = await Promise.all([
    getWorksByGenre(genre.slug),
    getPopularWorksByGenre(genre.slug, 8),
    getLatestWorks(100),
  ]);
  const latestWorks = allLatest
    .filter((w) => w.genreSlugs.includes(genre.slug))
    .slice(0, 8);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ジャンル一覧", path: "/genres" },
            { name: genre.name, path: `/genres/${genre.slug}` },
          ]),
          createItemListJsonLd(
            `${genre.name}の作品一覧`,
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
            { label: "ジャンル一覧", href: "/genres" },
            { label: genre.name },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {genre.name}の作品一覧
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {genre.longDescription}
          </p>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        {popularWorks.length > 0 && (
          <section aria-labelledby="genre-popular" className="mb-10">
            <SectionHeader title="人気作品" id="genre-popular" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {popularWorks.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          </section>
        )}

        {latestWorks.length > 0 && (
          <section aria-labelledby="genre-latest" className="mb-10">
            <SectionHeader title="最新作品" id="genre-latest" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {latestWorks.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="genre-all">
          <SectionHeader title="全作品" id="genre-all" />
          {works.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在、このジャンルに該当する作品はありません。
            </p>
          )}
        </section>
      </PageLayout>
    </>
  );
}
