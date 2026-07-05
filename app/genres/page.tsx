import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllGenres } from "@/data/genres";
import { getAllWorks } from "@/lib/works/repository";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: "ジャンル一覧",
  description: pageIntros.genres,
  path: "/genres",
});

export default async function GenresPage() {
  const genres = getAllGenres();
  const allWorks = await getAllWorks();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ジャンル一覧", path: "/genres" },
          ]),
          createItemListJsonLd(
            "ジャンル一覧",
            genres.map((genre) => ({
              name: genre.name,
              url: `${siteConfig.url}/genres/${genre.slug}`,
            })),
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
          {genres.map((genre) => {
            const workCount = allWorks.filter(
              (work) =>
                work.genreSlugs.includes(genre.slug) ||
                work.genreNames.includes(genre.name),
            ).length;

            return (
              <Link
                key={genre.slug}
                href={`/genres/${genre.slug}`}
                className="rounded border border-border bg-white p-5 text-center shadow-sm transition-shadow hover:border-accent/30 hover:shadow-md"
              >
                <h2 className="text-base font-bold text-foreground">
                  {genre.name}
                </h2>
                <p className="mt-2 text-xs text-muted">{workCount}作品</p>
                <p className="mt-2 text-sm text-muted">{genre.description}</p>
              </Link>
            );
          })}
        </div>
      </PageLayout>
    </>
  );
}
