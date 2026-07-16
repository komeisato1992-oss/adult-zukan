import { PageLayout } from "@/components/layout/PageLayout";
import { DmmWorkScrollSection } from "@/components/home/DmmWorkScrollSection";
import { DmmActressCarousel } from "@/components/home/DmmActressCarousel";
import { DmmMakerRankingSection } from "@/components/home/DmmMakerRankingSection";
import { DmmSeriesRankingSection } from "@/components/home/DmmSeriesRankingSection";
import { DmmPopularGenreSection } from "@/components/home/DmmPopularGenreSection";
import { RandomCompareSection } from "@/components/home/RandomCompareSection";
import { SiteIntroSection } from "@/components/home/SiteIntroSection";
import { WorksDiscoverSection } from "@/components/home/WorksDiscoverSection";
import { LazySection } from "@/components/ui/LazySection";
import { UpdatedDate } from "@/components/ui/UpdatedDate";
import { getQuickCompareItems } from "@/lib/compare/quick-compare";
import { pickRandomComparePair } from "@/lib/home/random-compare-pair";
import { seoTitles } from "@/lib/seo/titles";
import { truncateDescription } from "@/lib/seo/descriptions";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  HOME_SECTION_LIMIT,
  getRankedGenres,
  getSharedCatalogWorks,
} from "@/lib/works/catalog";
import {
  fetchCachedPublicWorksSlice,
  isPublicWorksDbQueryAvailable,
} from "@/lib/works/public-list-query";
import {
  getPopularActresses,
  getPopularMakers,
  getPopularSeries,
} from "@/lib/ranking/entity-ranking-service";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { measureAsync } from "@/lib/perf/measure";

export const revalidate = 900;

export const metadata = createPageMetadata({
  title: seoTitles.home,
  description: truncateDescription(
    "アダルト図鑑は、複数のAV作品を並べて比較できる日本では珍しい作品比較サイトです。価格・女優・メーカー・シリーズ・ジャンルを一画面で比較しながら、作品選びができます。",
  ),
  absoluteTitle: true,
});

export default async function HomePage() {
  return measureAsync("page.home", async () => {
    const useDb = isPublicWorksDbQueryAvailable();

    const [
      popularFromDb,
      newFromDb,
      saleFromDb,
      actressesResult,
      makersResult,
      seriesResult,
    ] = await Promise.all([
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "popular",
            limit: HOME_SECTION_LIMIT,
            revalidateSec: 900,
            cacheKey: "home-popular",
          })
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "release-desc",
            limit: HOME_SECTION_LIMIT,
            revalidateSec: 600,
            cacheKey: "home-new",
          })
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "discount-desc",
            limit: HOME_SECTION_LIMIT,
            saleOnly: true,
            revalidateSec: 300,
            cacheKey: "home-sale",
          })
        : Promise.resolve([] as DmmItem[]),
      getPopularActresses(HOME_SECTION_LIMIT),
      getPopularMakers(8),
      getPopularSeries(8),
    ]);

    let popularWorks = popularFromDb;
    let newWorks = newFromDb;
    let saleWorks = saleFromDb;
    let catalogFallback: DmmItem[] | null = null;

    // 主要セクションが空のときだけカタログへフォールバック（セール0件では落とさない）
    if (!useDb || popularWorks.length === 0 || newWorks.length === 0) {
      const { getPopularWorks, getNewWorks, getSaleWorks } = await import(
        "@/lib/dmm/home-sections"
      );
      catalogFallback = await getSharedCatalogWorks();
      if (popularWorks.length === 0) {
        popularWorks = getPopularWorks(catalogFallback, HOME_SECTION_LIMIT);
      }
      if (newWorks.length === 0) {
        newWorks = getNewWorks(catalogFallback, HOME_SECTION_LIMIT);
      }
      if (saleWorks.length === 0) {
        saleWorks = getSaleWorks(catalogFallback, HOME_SECTION_LIMIT);
      }
    }

    const comparePool =
      catalogFallback != null
        ? filterDisplayableItems(catalogFallback)
        : [...popularWorks, ...newWorks, ...saleWorks];

    const { mergeLiveStatusIntoItems } = await import(
      "@/lib/dmm/work-live-status"
    );

    const [popularMerged, newMerged, saleMerged, randomComparePairMerged] =
      await Promise.all([
        mergeLiveStatusIntoItems(popularWorks),
        mergeLiveStatusIntoItems(newWorks),
        mergeLiveStatusIntoItems(saleWorks),
        (async () => {
          const pair = pickRandomComparePair(comparePool);
          return pair ? mergeLiveStatusIntoItems(pair) : null;
        })(),
      ]);

    const rankedActresses = actressesResult.items.map((actress) => ({
      name: actress.name,
      slug: actress.slug,
      workCount: actress.workCount,
      imageUrl: actress.imageUrl,
      imageFromMultiActressWork: actress.imageFromMultiActressWork,
    }));
    const rankedMakers = makersResult.items.map((maker) => ({
      name: maker.name,
      slug: maker.slug,
      workCount: maker.workCount,
    }));
    const rankedSeries = seriesResult.items.map((series) => ({
      name: series.name,
      slug: series.slug,
      workCount: series.workCount,
    }));

    const rankedGenres =
      catalogFallback != null
        ? getRankedGenres(catalogFallback, HOME_SECTION_LIMIT)
        : [
            { name: "ドラマ", slug: "ドラマ", workCount: 0 },
            { name: "恋愛", slug: "恋愛", workCount: 0 },
            { name: "ドキュメンタリー", slug: "ドキュメンタリー", workCount: 0 },
            { name: "企画", slug: "企画", workCount: 0 },
            { name: "熟女", slug: "熟女", workCount: 0 },
            { name: "新人", slug: "新人", workCount: 0 },
          ];

    const updatedDate = new Date().toISOString().split("T")[0];
    const quickCompare = getQuickCompareItems({
      siteType: "adult",
      count: 2,
      adultCatalog: comparePool,
    });
    const randomComparePair =
      randomComparePairMerged && randomComparePairMerged.length >= 2
        ? ([
            randomComparePairMerged[0],
            randomComparePairMerged[1],
          ] as [DmmItem, DmmItem])
        : null;

    return (
      <>
        <SiteIntroSection quickCompare={quickCompare} />

        {randomComparePair ? (
          <RandomCompareSection items={randomComparePair} />
        ) : null}

        <PageLayout>
          <WorksDiscoverSection />

          <UpdatedDate date={updatedDate} className="mb-6 text-xs text-muted" />

          <DmmWorkScrollSection
            id="popular-works"
            title="🔥 人気作品"
            items={popularMerged}
            href="/works?sort=popular"
          />

          <LazySection minHeight={320}>
            <DmmWorkScrollSection
              id="new-works"
              title="🆕 新着作品"
              items={newMerged}
              href="/works?sort=new"
            />
          </LazySection>

          <LazySection minHeight={320}>
            <DmmWorkScrollSection
              id="sale-works"
              title="💰 セール作品"
              items={saleMerged}
              href="/works?sale=true"
            />
          </LazySection>

          <LazySection minHeight={280}>
            <DmmActressCarousel
              actresses={rankedActresses}
              id="popular-actresses"
              title="🏆 人気女優"
            />
          </LazySection>

          <LazySection minHeight={200}>
            <DmmMakerRankingSection makers={rankedMakers} id="popular-makers" />
            <DmmSeriesRankingSection series={rankedSeries} id="popular-series" />
            <DmmPopularGenreSection genres={rankedGenres} id="popular-genres" />
          </LazySection>
        </PageLayout>
      </>
    );
  });
}
