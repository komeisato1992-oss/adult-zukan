import { Suspense } from "react";
import { ActressListSection } from "@/components/actresses/ActressListSection";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getActressListItems } from "@/lib/actresses/list";
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
  title: seoTitles.actresses,
  description: truncateDescription(pageIntros.actresses),
  path: "/actresses",
  absoluteTitle: true,
});

function ActressListFallback() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-border/80 bg-white"
        >
          <div className="aspect-[3/4] animate-pulse bg-surface" />
          <div className="space-y-2 p-3">
            <div className="h-4 animate-pulse rounded bg-surface" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ActressesPage() {
  const actresses = await getActressListItems();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "女優一覧", path: "/actresses" },
          ]),
          createCollectionPageJsonLd(
            "女優一覧",
            pageIntros.actresses,
            `${siteConfig.url}/actresses`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "女優一覧" }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            女優一覧
          </h1>
          <PageIntro text={pageIntros.actresses} />
        </header>

        <Suspense fallback={<ActressListFallback />}>
          <ActressListSection actresses={actresses} />
        </Suspense>
      </PageLayout>
    </>
  );
}
