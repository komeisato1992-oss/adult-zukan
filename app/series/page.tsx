import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllSeries } from "@/data/series";
import { getAllWorks } from "@/lib/works/repository";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";
import Link from "next/link";

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: "シリーズ一覧",
  description: pageIntros.series,
  path: "/series",
});

export default async function SeriesPage() {
  const series = getAllSeries();
  const allWorks = await getAllWorks();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "シリーズ一覧", path: "/series" },
          ]),
          createItemListJsonLd(
            "シリーズ一覧",
            series.map((s) => ({
              name: s.name,
              url: `${siteConfig.url}/series/${s.slug}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "シリーズ一覧" }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            シリーズ一覧
          </h1>
          <PageIntro text={pageIntros.series} />
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => {
            const count = allWorks.filter((w) => w.seriesSlug === s.slug).length;
            return (
              <Link
                key={s.slug}
                href={`/series/${s.slug}`}
                className="rounded-lg border border-border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
              >
                <h2 className="text-base font-bold text-foreground">{s.name}</h2>
                <p className="mt-1 text-xs text-muted">{count}作品</p>
                <p className="mt-2 line-clamp-3 text-sm text-muted">
                  {s.description}
                </p>
              </Link>
            );
          })}
        </div>
      </PageLayout>
    </>
  );
}
