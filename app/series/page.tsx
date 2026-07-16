import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import { getSeriesDetailPath } from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";
import { getCachedSeriesSummaries } from "@/lib/catalog/cached-entity-summaries";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.series,
  description: truncateDescription(pageIntros.series),
  path: "/series",
  absoluteTitle: true,
});

export default async function SeriesPage() {
  const series = (await getCachedSeriesSummaries()).sort(
    (a, b) =>
      b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
  );

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "シリーズ一覧", path: "/series" },
          ]),
          createCollectionPageJsonLd(
            "シリーズ一覧",
            pageIntros.series,
            `${siteConfig.url}/series`,
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

        <div className="grid gap-4 max-[768px]:gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((entry) => (
            <Link
              key={entry.slug}
              href={getSeriesDetailPath(entry.slug)}
              className="rounded-lg border border-border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
            >
              <h2 className="text-base font-bold text-foreground">
                {entry.name}
              </h2>
              <p className="mt-1 text-xs text-muted">{entry.workCount}作品</p>
            </Link>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
