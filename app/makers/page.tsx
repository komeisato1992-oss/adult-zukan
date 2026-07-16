import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import { getMakerDetailPath } from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";
import { getCachedMakerSummaries } from "@/lib/catalog/cached-entity-summaries";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.makers,
  description: truncateDescription(pageIntros.makers),
  path: "/makers",
  absoluteTitle: true,
});

export default async function MakersPage() {
  const makers = await getCachedMakerSummaries();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "メーカー一覧", path: "/makers" },
          ]),
          createCollectionPageJsonLd(
            "メーカー一覧",
            pageIntros.makers,
            `${siteConfig.url}/makers`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "メーカー一覧" }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            メーカー一覧
          </h1>
          <PageIntro text={pageIntros.makers} />
        </header>

        <div className="grid gap-4 max-[768px]:gap-2.5 sm:grid-cols-2">
          {makers.map((maker) => (
            <article
              key={maker.slug}
              className="rounded border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="text-base font-bold text-foreground">
                <Link
                  href={getMakerDetailPath(maker.slug)}
                  className="hover:text-accent"
                >
                  {maker.name}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-muted">
                掲載作品 {maker.workCount}件
              </p>
              <Link
                href={getMakerDetailPath(maker.slug)}
                className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
              >
                詳細を見る →
              </Link>
            </article>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
