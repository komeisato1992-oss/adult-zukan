import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllLabels } from "@/data/labels";
import { getWorksByLabel } from "@/lib/works/repository";
import { pageIntros } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";

export const metadata = createPageMetadata({
  title: "レーベル一覧",
  description: "アダルト作品レーベル一覧。20レーベルの作品をブランド別に探せます。",
  path: "/labels",
});

export default async function LabelsPage() {
  const labels = getAllLabels();
  const counts = await Promise.all(
    labels.map(async (label) => ({
      label,
      count: (await getWorksByLabel(label.slug)).length,
    })),
  );

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "レーベル一覧", path: "/labels" },
          ]),
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
          {counts.map(({ label, count }) => (
            <article
              key={label.slug}
              className="rounded-lg border border-border bg-white p-5 transition-shadow hover:shadow-md"
            >
              <Link href={`/labels/${label.slug}`} className="block">
                <p className="text-xs text-muted">{label.makerName}</p>
                <h2 className="mt-1 text-base font-bold text-foreground">
                  {label.name}
                </h2>
                <p className="mt-2 text-sm text-muted line-clamp-2">
                  {label.description}
                </p>
                <p className="mt-3 text-xs font-medium text-accent">
                  {count}作品 →
                </p>
              </Link>
            </article>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
