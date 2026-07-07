import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogGenres,
  getCatalogItems,
} from "@/lib/dmm/catalog-entities";
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

export default async function GenresPage() {
  const items = await getCatalogItems();
  const genres = getCatalogGenres(items);

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

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {genres.map((genre) => (
            <Link
              key={genre.slug}
              href={`/genres/${genre.slug}`}
              className="rounded border border-border bg-white p-5 text-center shadow-sm transition-shadow hover:border-accent/30 hover:shadow-md"
            >
              <h2 className="text-base font-bold text-foreground">
                {genre.name}
              </h2>
              <p className="mt-2 text-xs text-muted">{genre.workCount}作品</p>
            </Link>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
