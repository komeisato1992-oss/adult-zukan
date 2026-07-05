import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllMakers } from "@/data/makers";
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
  title: "メーカー一覧",
  description: pageIntros.makers,
  path: "/makers",
});

export default async function MakersPage() {
  const makers = getAllMakers();
  const allWorks = await getAllWorks();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "メーカー一覧", path: "/makers" },
          ]),
          createItemListJsonLd(
            "メーカー一覧",
            makers.map((maker) => ({
              name: maker.name,
              url: `${siteConfig.url}/makers/${maker.slug}`,
            })),
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

        <div className="grid gap-4 sm:grid-cols-2">
          {makers.map((maker) => {
            const workCount = allWorks.filter(
              (work) => work.makerSlug === maker.slug,
            ).length;

            return (
              <article
                key={maker.slug}
                className="rounded border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <h2 className="text-base font-bold text-foreground">
                  <Link
                    href={`/makers/${maker.slug}`}
                    className="hover:text-accent"
                  >
                    {maker.name}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted">掲載作品 {workCount}件</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {maker.description}
                </p>
                <Link
                  href={`/makers/${maker.slug}`}
                  className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
                >
                  詳細を見る →
                </Link>
              </article>
            );
          })}
        </div>
      </PageLayout>
    </>
  );
}
