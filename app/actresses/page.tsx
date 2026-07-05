import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ActressCard } from "@/components/ui/ActressCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllActresses, getRankedActresses } from "@/data/actresses";
import { getWorksByActress } from "@/lib/works/repository";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: "女優一覧",
  description: pageIntros.actresses,
  path: "/actresses",
});

export default async function ActressesPage() {
  const actresses = getAllActresses();
  const ranked = getRankedActresses(3);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "女優一覧", path: "/actresses" },
          ]),
          createItemListJsonLd(
            "女優一覧",
            actresses.map((actress) => ({
              name: actress.name,
              url: `${siteConfig.url}/actresses/${actress.slug}`,
            })),
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

        <section aria-labelledby="top-actresses" className="mb-8">
          <h2 id="top-actresses" className="mb-4 text-lg font-bold text-foreground">
            人気女優 TOP3
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {await Promise.all(
              ranked.map(async (actress, index) => {
                const works = await getWorksByActress(actress.slug);
                return (
                  <ActressCard
                    key={actress.slug}
                    actress={actress}
                    rank={index + 1}
                    workCount={works.length}
                  />
                );
              }),
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {await Promise.all(
            actresses.map(async (actress) => {
              const works = await getWorksByActress(actress.slug);
              return (
                <ActressCard
                  key={actress.slug}
                  actress={actress}
                  workCount={works.length}
                />
              );
            }),
          )}
        </div>
      </PageLayout>
    </>
  );
}
