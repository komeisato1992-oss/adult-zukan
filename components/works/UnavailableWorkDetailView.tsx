import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DmmRelatedWorkCard } from "@/components/works/DmmRelatedWorkCard";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { getCatalogWorks } from "@/lib/catalog";
import type { DmmItem } from "@/lib/dmm/types";
import { slugify } from "@/lib/utils";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { RELATED_WORKS_DISPLAY_LIMIT } from "@/lib/pagination";

type UnavailableWorkDetailViewProps = {
  item: DmmItem;
};

function pickRelatedWorks(
  catalog: DmmItem[],
  item: DmmItem,
  limit: number,
): {
  sameActress: DmmItem[];
  sameSeries: DmmItem[];
  sameGenre: DmmItem[];
} {
  const actressName = getDmmItemActressNameList(item)[0];
  const seriesName = getDmmItemSeriesName(item);
  const genreSlugs = new Set(
    (item.iteminfo?.genre ?? [])
      .map((genre) => (genre.name ? slugify(genre.name) : ""))
      .filter(Boolean),
  );

  const sameActress = actressName
    ? catalog.filter(
        (work) =>
          work.content_id !== item.content_id &&
          getDmmItemActressNameList(work).includes(actressName),
      )
    : [];

  const sameSeries = seriesName
    ? catalog.filter(
        (work) =>
          work.content_id !== item.content_id &&
          getDmmItemSeriesName(work) === seriesName,
      )
    : [];

  const sameGenre = genreSlugs.size
    ? catalog.filter((work) => {
        if (work.content_id === item.content_id) return false;
        return (work.iteminfo?.genre ?? []).some(
          (genre) => genre.name && genreSlugs.has(slugify(genre.name)),
        );
      })
    : [];

  return {
    sameActress: sameActress.slice(0, limit),
    sameSeries: sameSeries.slice(0, limit),
    sameGenre: sameGenre.slice(0, limit),
  };
}

export async function UnavailableWorkDetailView({
  item,
}: UnavailableWorkDetailViewProps) {
  const catalog = await getCatalogWorks();
  const imageUrl = getDmmItemImageUrl(item);
  const related = pickRelatedWorks(catalog, item, RELATED_WORKS_DISPLAY_LIMIT);

  return (
    <>
      <JsonLd
        data={createBreadcrumbJsonLd([
          { name: "トップ", path: "/" },
          { name: "作品一覧", path: "/works" },
          { name: item.title, path: `/works/${item.content_id}` },
        ])}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "作品一覧", href: "/works" },
            { label: item.title },
          ]}
        />

        <article className="mt-6">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <div className="relative mx-auto block aspect-[2/3] w-full max-w-xs overflow-hidden rounded border border-border lg:mx-0 lg:max-w-none">
              {imageUrl ? (
                <CatalogWorkImage
                  src={imageUrl}
                  alt={item.title}
                  variant="portrait"
                  sizes="(max-width: 1024px) 280px, 280px"
                  frameClassName="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
                  No Image
                </div>
              )}
            </div>

            <div>
              <header>
                <p className="text-sm text-muted">{item.product_id ?? item.content_id}</p>
                <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                  この作品は現在販売されていません
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                  {item.title}
                </p>
              </header>

              <div className="mt-8 rounded border border-border bg-surface p-6 text-sm leading-relaxed text-muted">
                この作品はFANZAでの販売を確認できないため、現在一覧には掲載していません。
              </div>
            </div>
          </div>

          {related.sameActress.length > 0 ? (
            <section aria-labelledby="same-actress-works" className="mt-12">
              <SectionHeader
                title="同じ女優の販売中作品"
                id="same-actress-works"
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {related.sameActress.map((work) => (
                  <DmmRelatedWorkCard key={work.content_id} item={work} />
                ))}
              </div>
            </section>
          ) : null}

          {related.sameSeries.length > 0 ? (
            <section aria-labelledby="same-series-works" className="mt-12">
              <SectionHeader
                title="同じシリーズの販売中作品"
                id="same-series-works"
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {related.sameSeries.map((work) => (
                  <DmmRelatedWorkCard key={work.content_id} item={work} />
                ))}
              </div>
            </section>
          ) : null}

          {related.sameGenre.length > 0 ? (
            <section aria-labelledby="same-genre-works" className="mt-12">
              <SectionHeader
                title="同じジャンルの人気作品"
                id="same-genre-works"
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {related.sameGenre.map((work) => (
                  <DmmRelatedWorkCard key={work.content_id} item={work} />
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </PageLayout>
    </>
  );
}
