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
import { pickRandomComparePair } from "@/lib/home/random-compare-pair";
import { seoTitles } from "@/lib/seo/titles";
import { truncateDescription } from "@/lib/seo/descriptions";
import { createPageMetadata } from "@/lib/seo/metadata";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import {
  HOME_SECTION_LIMIT,
  getNewWorks,
  getPopularWorks,
  getRankedActresses,
  getRankedGenres,
  getRankedMakers,
  getRankedSeries,
  getSaleWorks,
  getSharedCatalogWorks,
} from "@/lib/works/catalog";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: seoTitles.home,
  description: truncateDescription(
    "アダルト図鑑は、複数のAV作品を並べて比較できる日本では珍しい作品比較サイトです。価格・女優・メーカー・シリーズ・ジャンルを一画面で比較しながら、作品選びができます。",
  ),
  absoluteTitle: true,
});

export default async function HomePage() {
  const catalog = await getSharedCatalogWorks();
  const displayableItems = filterDisplayableItems(catalog);

  const popularWorks = getPopularWorks(catalog, HOME_SECTION_LIMIT);
  const newWorks = getNewWorks(catalog, HOME_SECTION_LIMIT);
  const saleWorks = getSaleWorks(catalog, HOME_SECTION_LIMIT);
  const rankedActresses = getRankedActresses(catalog, HOME_SECTION_LIMIT);
  const rankedMakers = getRankedMakers(catalog);
  const rankedSeries = getRankedSeries(catalog);
  const rankedGenres = getRankedGenres(catalog);

  const updatedDate = new Date().toISOString().split("T")[0];
  const randomComparePair = pickRandomComparePair(displayableItems);

  return (
    <>
      <SiteIntroSection />

      {randomComparePair ? (
        <RandomCompareSection items={randomComparePair} />
      ) : null}

      <PageLayout>
        <WorksDiscoverSection />

        <UpdatedDate date={updatedDate} className="mb-6 text-xs text-muted" />

        <DmmWorkScrollSection
          id="popular-works"
          title="🔥 人気作品"
          items={popularWorks}
          href="/works?sort=popular"
        />

        <LazySection minHeight={320}>
          <DmmWorkScrollSection
            id="new-works"
            title="🆕 新着作品"
            items={newWorks}
            href="/works?sort=release-desc"
          />
        </LazySection>

        <LazySection minHeight={320}>
          <DmmWorkScrollSection
            id="sale-works"
            title="💰 セール作品"
            items={saleWorks}
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
}
