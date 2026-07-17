import { PageLayout } from "@/components/layout/PageLayout";
import { DmmWorkScrollSection } from "@/components/home/DmmWorkScrollSection";
import { DmmActressCarousel } from "@/components/home/DmmActressCarousel";
import { DmmMakerRankingSection } from "@/components/home/DmmMakerRankingSection";
import { DmmSeriesRankingSection } from "@/components/home/DmmSeriesRankingSection";
import { DmmPopularGenreSection } from "@/components/home/DmmPopularGenreSection";
import {
  HOME_GENRE_DISPLAY_LIMIT,
  HomeGenreDiscoverSection,
} from "@/components/home/HomeGenreDiscoverSection";
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
import {
  getNewWorks,
  getPopularWorks,
  getSaleWorks,
} from "@/lib/dmm/home-sections";
import { getCachedGenreSummaries } from "@/lib/catalog/cached-entity-summaries";
import { mergeLiveStatusIntoItems } from "@/lib/dmm/work-live-status";
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

    const safeSlice = async (
      loader: () => Promise<DmmItem[]>,
      label: string,
    ): Promise<DmmItem[]> => {
      try {
        return await loader();
      } catch (error) {
        console.warn(`[home] ${label} slice failed`, error);
        return [];
      }
    };

    const [
      popularFromDb,
      newFromDb,
      saleFromDb,
      actressesResult,
      makersResult,
      seriesResult,
      genreSummaries,
    ] = await Promise.all([
      useDb
        ? safeSlice(
            () =>
              fetchCachedPublicWorksSlice({
                sort: "popular",
                limit: HOME_SECTION_LIMIT,
                revalidateSec: 900,
                cacheKey: "home-popular",
              }),
            "popular",
          )
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? safeSlice(async () => {
            const fanzaNew = await fetchCachedPublicWorksSlice({
              sort: "fanza-new",
              limit: HOME_SECTION_LIMIT,
              revalidateSec: 600,
              cacheKey: "home-fanza-new",
            });
            if (fanzaNew.length > 0) return fanzaNew;
            return fetchCachedPublicWorksSlice({
              sort: "release-new",
              limit: HOME_SECTION_LIMIT,
              revalidateSec: 600,
              cacheKey: "home-new",
            });
          }, "new")
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? safeSlice(
            () =>
              fetchCachedPublicWorksSlice({
                sort: "discount",
                limit: HOME_SECTION_LIMIT,
                saleOnly: true,
                revalidateSec: 300,
                cacheKey: "home-sale",
              }),
            "sale",
          )
        : Promise.resolve([] as DmmItem[]),
      getPopularActresses(HOME_SECTION_LIMIT),
      getPopularMakers(8),
      getPopularSeries(8),
      getCachedGenreSummaries().catch((error) => {
        console.warn("[home] genre summaries failed", error);
        return [] as Awaited<ReturnType<typeof getCachedGenreSummaries>>;
      }),
    ]);

    let popularWorks = popularFromDb;
    let newWorks = newFromDb;
    let saleWorks = saleFromDb;
    let catalogFallback: DmmItem[] | null = null;

    // 主要セクションが空のときだけカタログへフォールバック（セール0件では落とさない）
    if (!useDb || popularWorks.length === 0 || newWorks.length === 0) {
      try {
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
      } catch (error) {
        console.warn("[home] catalog fallback failed", error);
      }
    }

    const comparePool =
      catalogFallback != null
        ? filterDisplayableItems(catalogFallback)
        : [...popularWorks, ...newWorks, ...saleWorks];

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

    const rankedGenres = genreSummaries
      .slice(0, HOME_SECTION_LIMIT)
      .map((genre) => ({
        name: genre.name,
        slug: genre.slug,
        workCount: genre.workCount,
      }));
    const homeGenres = genreSummaries
      .slice(0, HOME_GENRE_DISPLAY_LIMIT)
      .map((genre) => ({
        name: genre.name,
        slug: genre.slug,
        workCount: genre.workCount,
      }));

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
            moreLabel="人気作品"
          />

          <LazySection minHeight={240}>
            <DmmWorkScrollSection
              id="new-works"
              title="🆕 新着作品"
              items={newMerged}
              href="/works?sort=fanza-new"
              moreLabel="新着作品"
            />
          </LazySection>

          <LazySection minHeight={240}>
            <DmmWorkScrollSection
              id="sale-works"
              title="💰 セール作品"
              items={saleMerged}
              href="/sale"
              moreLabel="セール作品"
            />
          </LazySection>

          <LazySection minHeight={200}>
            <DmmActressCarousel
              actresses={rankedActresses}
              id="popular-actresses"
              title="🏆 人気女優"
              href="/actresses?sort=works"
            />
          </LazySection>

          <HomeGenreDiscoverSection genres={homeGenres} id="home-genres" />

          {/* 人気メーカー・シリーズ・ジャンルは PC のみ（スマホTOPでは非表示） */}
          <div className="hidden min-[769px]:block">
            <LazySection minHeight={200}>
              <DmmMakerRankingSection makers={rankedMakers} id="popular-makers" />
              <DmmSeriesRankingSection series={rankedSeries} id="popular-series" />
              <DmmPopularGenreSection genres={rankedGenres} id="popular-genres" />
            </LazySection>
          </div>
        </PageLayout>
      </>
    );
  });
}
