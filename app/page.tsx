import { PageLayout } from "@/components/layout/PageLayout";
import { DmmHeroCarousel } from "@/components/home/DmmHeroCarousel";
import { DmmWorkScrollSection } from "@/components/home/DmmWorkScrollSection";
import { DmmActressCarousel } from "@/components/home/DmmActressCarousel";
import { DmmMakerRankingSection } from "@/components/home/DmmMakerRankingSection";
import { DmmSeriesRankingSection } from "@/components/home/DmmSeriesRankingSection";
import { DmmPopularGenreSection } from "@/components/home/DmmPopularGenreSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { UpdatedDate } from "@/components/ui/UpdatedDate";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createItemListJsonLd } from "@/lib/seo/json-ld";
import {
  getHeroWorks,
  getMonthlyRankingWorks,
  getNewWorks,
  getPopularWorks,
  getRankedActresses,
  getRankedGenres,
  getRankedMakers,
  getRankedSeries,
  getSaleWorks,
  getSharedCatalogWorks,
  getWeeklyRankingWorks,
} from "@/lib/works/catalog";

export const revalidate = 86400;

export const metadata = createPageMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
});

export default async function HomePage() {
  const catalog = await getSharedCatalogWorks();

  const heroWorks = getHeroWorks(catalog, 1);
  const popularWorks = getPopularWorks(catalog);
  const newWorks = getNewWorks(catalog);
  const saleWorks = getSaleWorks(catalog);
  const rankedActresses = getRankedActresses(catalog);
  const rankedMakers = getRankedMakers(catalog);
  const rankedSeries = getRankedSeries(catalog);
  const rankedGenres = getRankedGenres(catalog);
  const weeklyWorks = getWeeklyRankingWorks(catalog);
  const monthlyWorks = getMonthlyRankingWorks(catalog);

  const updatedDate = new Date().toISOString().split("T")[0];

  return (
    <>
      {heroWorks.length > 0 && (
        <JsonLd
          data={createItemListJsonLd(
            "おすすめ作品",
            heroWorks.map((item) => ({
              name: item.title,
              url: `${siteConfig.url}/works/${item.content_id}`,
            })),
          )}
        />
      )}

      <DmmHeroCarousel items={heroWorks} />

      <PageLayout>
        <UpdatedDate date={updatedDate} className="mb-6 text-xs text-muted" />

        <DmmWorkScrollSection
          id="popular-works"
          title="人気作品"
          items={popularWorks}
          href="/works"
        />

        <DmmWorkScrollSection
          id="new-works"
          title="新着作品"
          items={newWorks}
          href="/works?sort=new"
        />

        <DmmWorkScrollSection
          id="sale-works"
          title="セール作品"
          items={saleWorks}
          href="/works?filter=sale"
        />

        <DmmActressCarousel
          actresses={rankedActresses}
          id="popular-actresses"
        />

        <DmmMakerRankingSection makers={rankedMakers} id="popular-makers" />

        <DmmSeriesRankingSection series={rankedSeries} id="popular-series" />

        <DmmPopularGenreSection genres={rankedGenres} id="popular-genres" />

        <DmmWorkScrollSection
          id="weekly-ranking"
          title="週間ランキング"
          items={weeklyWorks}
          href="/ranking/weekly"
        />

        <DmmWorkScrollSection
          id="monthly-ranking"
          title="月間ランキング"
          items={monthlyWorks}
          href="/ranking/monthly"
        />
      </PageLayout>
    </>
  );
}
