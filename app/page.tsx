import { PageLayout } from "@/components/layout/PageLayout";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { WorkScrollSection } from "@/components/home/WorkScrollSection";
import { ActressCarousel } from "@/components/home/ActressCarousel";
import { MakerRankingSection } from "@/components/home/MakerRankingSection";
import { SeriesRankingSection } from "@/components/home/SeriesRankingSection";
import { PopularGenreSection } from "@/components/home/PopularGenreSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { UpdatedDate } from "@/components/ui/UpdatedDate";
import {
  getAllWorks,
  getFeaturedWorks,
  getLatestWorks,
  getRankedWorks,
  getSaleWorks,
  getWeeklyRankedWorks,
  getMonthlyRankedWorks,
} from "@/lib/works/repository";
import { getRankedActresses } from "@/data/actresses";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createItemListJsonLd } from "@/lib/seo/json-ld";

export const revalidate = 3600;

export const metadata = createPageMetadata({
  title: siteConfig.name,
  description: siteConfig.description,
});

export default async function HomePage() {
  const [
    featuredWorks,
    popularWorks,
    latestWorks,
    saleWorks,
    weeklyWorks,
    monthlyWorks,
    allWorks,
  ] = await Promise.all([
    getFeaturedWorks(5),
    getRankedWorks(10),
    getLatestWorks(10),
    getSaleWorks(),
    getWeeklyRankedWorks(10),
    getMonthlyRankedWorks(10),
    getAllWorks(),
  ]);

  const rankedActresses = getRankedActresses(10);
  const updatedDate = new Date().toISOString().split("T")[0];

  return (
    <>
      <JsonLd
        data={createItemListJsonLd(
          "おすすめ作品",
          featuredWorks.map((work) => ({
            name: work.title,
            url: `${siteConfig.url}/works/${work.slug}`,
          })),
        )}
      />

      <HeroCarousel works={featuredWorks} />

      <PageLayout>
        <UpdatedDate date={updatedDate} className="mb-6 text-xs text-muted" />

        <WorkScrollSection
          id="popular-works"
          title="人気作品"
          works={popularWorks}
          href="/ranking/works"
        />

        <WorkScrollSection
          id="new-works"
          title="新着作品"
          works={latestWorks}
          href="/works?sort=new"
        />

        <WorkScrollSection
          id="sale-works"
          title="セール作品"
          works={saleWorks.slice(0, 10)}
          href="/works?sale=1"
        />

        <ActressCarousel
          actresses={rankedActresses}
          works={allWorks}
          id="popular-actresses"
        />

        <MakerRankingSection id="popular-makers" />

        <SeriesRankingSection id="popular-series" />

        <PopularGenreSection id="popular-genres" />

        <WorkScrollSection
          id="weekly-ranking"
          title="週間ランキング"
          works={weeklyWorks}
          href="/ranking/weekly"
        />

        <WorkScrollSection
          id="monthly-ranking"
          title="月間ランキング"
          works={monthlyWorks}
          href="/ranking/monthly"
        />
      </PageLayout>
    </>
  );
}
