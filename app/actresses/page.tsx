import Link from "next/link";
import Image from "next/image";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { JsonLd } from "@/components/seo/JsonLd";
import { getActressDetailPath } from "@/lib/actresses/slug";
import {
  getCatalogActresses,
  getCatalogItems,
} from "@/lib/dmm/catalog-entities";
import { siteConfig, pageIntros } from "@/lib/site-config";
import { PageIntro } from "@/components/ui/PageIntro";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";
import { isValidImageUrl } from "@/lib/works";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: "女優一覧",
  description: pageIntros.actresses,
  path: "/actresses",
});

export default async function ActressesPage() {
  const items = await getCatalogItems();
  const actresses = getCatalogActresses(items).sort(
    (a, b) =>
      b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
  );
  const ranked = actresses.slice(0, 3);

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
              url: `${siteConfig.url}${getActressDetailPath(actress.name)}`,
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

        {ranked.length > 0 && (
          <section aria-labelledby="top-actresses" className="mb-8">
            <h2
              id="top-actresses"
              className="mb-4 text-lg font-bold text-foreground"
            >
              人気女優 TOP3
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {ranked.map((actress, index) => (
                <Link
                  key={actress.slug}
                  href={getActressDetailPath(actress.name)}
                  className="group block overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[3/4] bg-surface">
                    {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
                      <Image
                        src={actress.imageUrl}
                        alt={actress.name}
                        fill
                        className="object-cover object-center"
                        sizes="200px"
                        unoptimized
                      />
                    ) : null}
                    <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-foreground group-hover:text-accent">
                      {actress.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {actress.workCount}作品
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {actresses.map((actress) => (
            <Link
              key={actress.slug}
              href={getActressDetailPath(actress.name)}
              className="group block overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[3/4] bg-surface">
                {isValidImageUrl(actress.imageUrl) && actress.imageUrl ? (
                  <Image
                    src={actress.imageUrl}
                    alt={actress.name}
                    fill
                    className="object-cover object-center"
                    sizes="200px"
                    unoptimized
                  />
                ) : null}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground group-hover:text-accent">
                  {actress.name}
                </p>
                <p className="mt-1 text-xs text-muted">{actress.workCount}作品</p>
              </div>
            </Link>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
