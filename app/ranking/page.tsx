import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  DmmRankedWorkList,
  RankedEntityList,
} from "@/components/ranking/RankingList";
import { DmmActressCarousel } from "@/components/home/DmmActressCarousel";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import {
  getMonthlyRankingWorks,
  getPopularWorks,
  getRankedActresses,
  getRankedMakers,
  getRankedSeries,
  getSharedCatalogWorks,
  getWeeklyRankingWorks,
} from "@/lib/works/catalog";
import { filterItemsWithValidImage } from "@/lib/works";

export const metadata = createPageMetadata({
  title: "ランキング",
  description:
    "人気作品・女優・メーカー・シリーズのランキング。週間・月間ランキングも掲載。",
  path: "/ranking",
});

export default async function RankingPage() {
  const catalog = await getSharedCatalogWorks();
  const popularWorks = filterItemsWithValidImage(getPopularWorks(catalog, 10));
  const weeklyWorks = filterItemsWithValidImage(getWeeklyRankingWorks(catalog, 10));
  const monthlyWorks = filterItemsWithValidImage(getMonthlyRankingWorks(catalog, 10));
  const rankedMakers = getRankedMakers(catalog, 10);
  const rankedSeries = getRankedSeries(catalog, 10);
  const popularActresses = getRankedActresses(catalog, 10);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
          ]),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング" },
          ]}
        />
        <header className="mt-4">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            ランキング
          </h1>
          <PageIntro text={`${siteConfig.name}の人気作品・女優・メーカー・シリーズランキングです。週間・月間のトレンドも確認できます。`} />
        </header>

        <RankingNav current="/ranking" />

        <section aria-labelledby="rank-works" className="mb-12">
          <SectionHeader
            title="人気作品ランキング"
            id="rank-works"
            href="/ranking/works"
          />
          <DmmRankedWorkList items={popularWorks} />
        </section>

        <section aria-labelledby="rank-weekly" className="mb-12">
          <SectionHeader
            title="週間ランキング"
            id="rank-weekly"
            href="/ranking/weekly"
          />
          <DmmRankedWorkList items={weeklyWorks} />
        </section>

        <section aria-labelledby="rank-monthly" className="mb-12">
          <SectionHeader
            title="月間ランキング"
            id="rank-monthly"
            href="/ranking/monthly"
          />
          <DmmRankedWorkList items={monthlyWorks} />
        </section>

        <section aria-labelledby="rank-actresses" className="mb-12">
          <SectionHeader
            title="人気女優ランキング"
            id="rank-actresses"
            href="/ranking/actresses"
          />
          <DmmActressCarousel
            actresses={popularActresses}
            id="rank-actresses-list"
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="rank-makers">
            <SectionHeader
              title="人気メーカーランキング"
              id="rank-makers"
              href="/ranking/makers"
            />
            <RankedEntityList
              items={rankedMakers.map((maker) => ({
                name: maker.name,
                href: `/makers/${maker.slug}`,
                meta: `${maker.workCount}作品`,
              }))}
            />
          </section>

          <section aria-labelledby="rank-series">
            <SectionHeader
              title="人気シリーズランキング"
              id="rank-series"
              href="/ranking/series"
            />
            <RankedEntityList
              items={rankedSeries.map((series) => ({
                name: series.name,
                href: `/series/${series.slug}`,
                meta: `${series.workCount}作品`,
              }))}
            />
          </section>
        </div>
      </PageLayout>
    </>
  );
}
