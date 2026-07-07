import { Suspense } from "react";
import { GenreListSection } from "@/components/genres/GenreListSection";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogGenres,
  getCatalogItems,
} from "@/lib/dmm/catalog-entities";
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

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.genres,
  description: truncateDescription(pageIntros.genres),
  path: "/genres",
  absoluteTitle: true,
});

function GenreListFallback() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded border border-border bg-white p-5 text-center shadow-sm"
        >
          <div className="mx-auto h-5 w-24 animate-pulse rounded bg-surface" />
          <div className="mx-auto mt-2 h-3 w-12 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}

export default async function GenresPage() {
  const items = await getCatalogItems();
  const genres = getCatalogGenres(items).map((genre) => ({
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
