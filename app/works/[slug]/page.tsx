import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { ActressCard } from "@/components/ui/ActressCard";
import { AffiliateButton } from "@/components/ui/AffiliateButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WorkThumbnail } from "@/components/ui/WorkThumbnail";
import { JsonLd } from "@/components/seo/JsonLd";
import { DmmWorkDetailView } from "@/components/works/DmmWorkDetailView";
import {
  getWorkBySlug,
  getRelatedWorks,
  getRelatedActressesForWork,
} from "@/lib/works/repository";
import { getCatalogWorkByContentId } from "@/lib/catalog";
import { getDmmStaticWorkContentIds } from "@/lib/dmm/static-works";
import { getGenreBySlug } from "@/data/genres";
import { getActressDetailPath } from "@/lib/actresses/slug";
import {
  getCatalogActresses,
  getCatalogItems,
} from "@/lib/dmm/catalog-entities";
import { getMakerBySlug } from "@/data/makers";
import { AffiliateDisclosureNote } from "@/components/ui/AffiliateDisclosureNote";
import { FavoriteButton } from "@/components/user/FavoriteButton";
import { HistoryTracker } from "@/components/user/HistoryTracker";
import { UpdatedDate } from "@/components/ui/UpdatedDate";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createWorkDescription } from "@/lib/seo/descriptions";
import { createWorkTitle } from "@/lib/seo/titles";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import {
  createBreadcrumbJsonLd,
  createWorkJsonLd,
} from "@/lib/seo/json-ld";
import { formatPrice, getDisplayPrice } from "@/lib/format";
import { AFFILIATE_LINK_REL, slugify } from "@/lib/utils";

export const revalidate = 86400;

export const dynamicParams = true;

type WorkDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const contentIds = await getDmmStaticWorkContentIds();
  return contentIds.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const dmmItem = await getCatalogWorkByContentId(slug);

  if (dmmItem) {
    const actressNames = getDmmItemActressNameList(dmmItem);
    const makerName = getDmmItemMakerName(dmmItem);
    const price = getDmmItemPrice(dmmItem);
    const imageUrl = getDmmItemImageUrl(dmmItem);

    return createPageMetadata({
      title: createWorkTitle(dmmItem.title),
      description: createWorkDescription({
        title: dmmItem.title,
        actressNames,
        makerName,
        price,
      }),
      path: `/works/${dmmItem.content_id}`,
      ogType: "article",
      absoluteTitle: true,
      ogImage: imageUrl,
    });
  }

  const work = await getWorkBySlug(slug);

  if (work) {
    return createPageMetadata({
      title: createWorkTitle(work.title),
      description: createWorkDescription({
        title: work.title,
        description: work.longDescription,
        actressNames: work.actressNames,
        makerName: work.makerName,
        price: formatPrice(getDisplayPrice(work).current),
      }),
      path: `/works/${work.slug}`,
      ogType: "article",
      absoluteTitle: true,
      ogImage: work.imageUrl,
    });
  }

  return createPageMetadata({
    title: "作品が見つかりません",
    description: "指定された作品は見つかりませんでした。",
    path: `/works/${slug}`,
    noIndex: true,
  });
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  const dmmItem = await getCatalogWorkByContentId(slug);

  if (dmmItem) {
    return <DmmWorkDetailView item={dmmItem} />;
  }

  const work = await getWorkBySlug(slug);

  if (!work) {
    notFound();
  }

  const [relatedWorks, relatedActresses, catalogItems] = await Promise.all([
    getRelatedWorks(work),
    getRelatedActressesForWork(work),
    getCatalogItems(),
  ]);
  const catalogActressNames = new Set(
    getCatalogActresses(catalogItems).map((actress) => actress.name),
  );
  const maker = getMakerBySlug(work.makerSlug);
  const { current, original, isOnSale } = getDisplayPrice(work);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "作品一覧", path: "/works" },
            { name: work.title, path: `/works/${work.slug}` },
          ]),
          createWorkJsonLd(work, work.makerName, work.actressNames),
        ]}
      />
      <HistoryTracker
        slug={work.slug}
        title={work.title}
        productCode={work.productCode}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "作品一覧", href: "/works" },
            { label: work.title },
          ]}
        />

        <article className="mt-6">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <a
              href={work.affiliateUrl}
              target="_blank"
              rel={AFFILIATE_LINK_REL}
              className="relative mx-auto block aspect-[2/3] w-full max-w-xs overflow-hidden rounded border border-border lg:mx-0 lg:max-w-none"
            >
              <WorkThumbnail title={work.title} variant="detail" className="h-full" />
              {isOnSale && (
                <span className="absolute left-3 top-3 z-10 rounded bg-accent px-2 py-1 text-xs font-bold text-white">
                  SALE
                </span>
              )}
            </a>

            <div>
              <header>
                <p className="text-sm text-muted">{work.productCode}</p>
                <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                  {work.title}
                </h1>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-accent">
                    {formatPrice(current)}
                  </span>
                  {original && (
                    <span className="text-base text-muted line-through">
                      {formatPrice(original)}
                    </span>
                  )}
                </div>
              </header>

              <dl className="mt-8 space-y-4 rounded border border-border bg-surface p-6">
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                  <dt className="font-medium text-muted">品番</dt>
                  <dd>{work.productCode}</dd>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                  <dt className="font-medium text-muted">発売日</dt>
                  <dd>
                    <time dateTime={work.releaseDate}>{work.releaseDate}</time>
                  </dd>
                </div>
                {work.duration > 0 && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">収録時間</dt>
                    <dd>{work.duration}分</dd>
                  </div>
                )}
                {work.makerName && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">メーカー</dt>
                    <dd>
                      <Link href={`/makers/${work.makerSlug}`} className="text-accent hover:underline">
                        {work.makerName}
                      </Link>
                    </dd>
                  </div>
                )}
                {work.labelName && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">レーベル</dt>
                    <dd>
                      <Link href={`/labels/${work.labelSlug}`} className="text-accent hover:underline">
                        {work.labelName}
                      </Link>
                    </dd>
                  </div>
                )}
                {work.seriesName && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">シリーズ</dt>
                    <dd>
                      <Link href={`/series/${work.seriesSlug}`} className="text-accent hover:underline">
                        {work.seriesName}
                      </Link>
                    </dd>
                  </div>
                )}
                {work.actressNames.length > 0 && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">出演</dt>
                    <dd className="flex flex-wrap gap-2">
                      {work.actressNames.map((name) => {
                        const href = catalogActressNames.has(name)
                          ? getActressDetailPath(name)
                          : `/search?q=${encodeURIComponent(name)}`;
                        return (
                          <Link
                            key={name}
                            href={href}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                          >
                            {name}
                          </Link>
                        );
                      })}
                    </dd>
                  </div>
                )}
                {work.genreNames.length > 0 && (
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <dt className="font-medium text-muted">ジャンル</dt>
                    <dd className="flex flex-wrap gap-2">
                      {work.genreNames.map((name) => {
                        const genre = getGenreBySlug(slugify(name));
                        const href = genre
                          ? `/genres/${genre.slug}`
                          : `/search?q=${encodeURIComponent(name)}`;
                        return (
                          <Link
                            key={name}
                            href={href}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                          >
                            {name}
                          </Link>
                        );
                      })}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-8">
                <AffiliateButton
                  url={work.affiliateUrl}
                  provider={work.affiliateProvider}
                  size="lg"
                  className="w-full sm:w-auto"
                />
                <AffiliateDisclosureNote className="mt-2" />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <FavoriteButton slug={work.slug} title={work.title} />
                  <UpdatedDate date={work.releaseDate} label="発売日" />
                </div>
              </div>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
              作品紹介
            </h2>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              {work.longDescription}
            </p>
          </section>

          {work.recommendPoints.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
                おすすめポイント
              </h2>
              <ul className="space-y-2 rounded border border-border bg-surface p-6">
                {work.recommendPoints.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-foreground">
                    <span className="text-accent">●</span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {relatedWorks.length > 0 && (
            <section aria-labelledby="related-works" className="mt-12">
              <SectionHeader title="関連作品" id="related-works" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {relatedWorks.map((related) => (
                  <WorkCard key={related.slug} work={related} />
                ))}
              </div>
            </section>
          )}

          {relatedActresses.length > 0 && (
            <section aria-labelledby="related-actresses" className="mt-12">
              <SectionHeader title="関連女優" id="related-actresses" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {relatedActresses.map((actress) => (
                  <ActressCard key={actress.slug} actress={actress} />
                ))}
              </div>
            </section>
          )}

          {maker && (
            <section aria-labelledby="related-maker" className="mt-12">
              <SectionHeader title="関連メーカー" id="related-maker" />
              <Link
                href={`/makers/${maker.slug}`}
                className="inline-flex rounded-lg border border-border bg-white px-6 py-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-bold text-foreground">{maker.name}</p>
                  <p className="mt-1 text-sm text-muted line-clamp-2">
                    {maker.description}
                  </p>
                </div>
              </Link>
            </section>
          )}
        </article>
      </PageLayout>
    </>
  );
}
