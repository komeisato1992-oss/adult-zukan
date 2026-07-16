import { Suspense } from "react";
import { GenreListSection } from "@/components/genres/GenreListSection";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getGenreReading } from "@/lib/genres/readings";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";
import { getCachedGenreSummaries } from "@/lib/catalog/cached-entity-summaries";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.genres,
  description: truncateDescription(pageIntros.genres),
  path: "/genres",
  absoluteTitle: true,
});

function GenreListFallback() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[60px] items-center rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm sm:min-h-[64px]"
        >
          <div className="flex w-full items-start justify-between gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-surface" />
            <div className="h-3 w-10 animate-pulse rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function GenresPage() {
  const genres = (await getCachedGenreSummaries()).map((genre) => ({
    ...genre,
    reading: getGenreReading(genre.name),
  }));

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ジャンル一覧", path: "/genres" },
          ]),
          createCollectionPageJsonLd(
            "ジャンル一覧",
            pageIntros.genres,
            `${siteConfig.url}/genres`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "ジャンル一覧" }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            ジャンル一覧
          </h1>
          <PageIntro text={pageIntros.genres} />
        </header>

        <Suspense fallback={<GenreListFallback />}>
          <GenreListSection genres={genres} />
        </Suspense>
      </PageLayout>
    </>
  );
}
