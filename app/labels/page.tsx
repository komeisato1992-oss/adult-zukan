import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCatalogItems,
  getCatalogLabels,
} from "@/lib/dmm/catalog-entities";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import { getLabelDetailPath } from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.labels,
  description: truncateDescription(pageIntros.labels),
  path: "/labels",
  absoluteTitle: true,
});

export default async function LabelsPage() {
  const items = await getCatalogItems();
  const labels = getCatalogLabels(items).sort(
    (a, b) =>
      b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
  );

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "レーベル一覧", path: "/labels" },
          ]),
          createCollectionPageJsonLd(
            "レーベル一覧",
            pageIntros.labels,
            `${siteConfig.url}/labels`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "レーベル一覧" },
          ]}
        />
        <header className="mt-4 mb-8">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            レーベル一覧
          </h1>
          <PageIntro text={pageIntros.labels} />
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((label) => (
            <article
              key={label.slug}
              className="rounded-lg border border-border bg-white p-5 transition-shadow hover:shadow-md"
            >
              <Link href={getLabelDetailPath(label.slug)} className="block">
                {label.makerName && (
                  <p className="text-xs text-muted">{label.makerName}</p>
                )}
                <h2 className="mt-1 text-base font-bold text-foreground">
                  {label.name}
                </h2>
                <p className="mt-3 text-xs font-medium text-accent">
                  {label.workCount}作品 →
                </p>
              </Link>
            </article>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
