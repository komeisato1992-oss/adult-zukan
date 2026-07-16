import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  DmmRankedWorkList,
  RankedEntityList,
  RankingEmptyState,
  toMakerEntityCards,
  toSeriesEntityCards,
} from "@/components/ranking/RankingList";
import { DmmActressCarousel } from "@/components/home/DmmActressCarousel";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { toRankingWorkCardItems } from "@/lib/ranking/work-card-item";
import {
  fetchCachedPublicWorksSlice,
  isPublicWorksDbQueryAvailable,
} from "@/lib/works/public-list-query";
import {
  getPopularActresses,
  getPopularMakers,
  getPopularSeries,
} from "@/lib/ranking/entity-ranking-service";
import type { DmmItem } from "@/lib/dmm/types";
import { measureAsync } from "@/lib/perf/measure";

export const revalidate = 21600;

export const metadata = createPageMetadata({
  title: "ランキング",
  description:
    "人気作品・女優・メーカー・シリーズのランキング。週間・月間ランキングも掲載。",
  path: "/ranking",
});

export default async function RankingPage() {
  return measureAsync("page.ranking", async () => {
    const useDb = isPublicWorksDbQueryAvailable();

    const [
      popularRaw,
      weeklyRaw,
      monthlyRaw,
      actressesResult,
      makersResult,
      seriesResult,
    ] = await Promise.all([
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "popular",
            limit: 10,
            revalidateSec: 21600,
            cacheKey: "ranking-popular",
          })
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "popular",
            limit: 10,
            revalidateSec: 21600,
            cacheKey: "ranking-weekly",
          })
        : Promise.resolve([] as DmmItem[]),
      useDb
        ? fetchCachedPublicWorksSlice({
            sort: "release-desc",
            limit: 10,
            revalidateSec: 21600,
            cacheKey: "ranking-monthly",
          })
        : Promise.resolve([] as DmmItem[]),
      getPopularActresses(10),
      getPopularMakers(10),
      getPopularSeries(10),
    ]);

    let popularWorks = popularRaw;
    let weeklyWorks = weeklyRaw;
    let monthlyWorks = monthlyRaw;

    if (
      !useDb ||
      popularWorks.length === 0 ||
      weeklyWorks.length === 0 ||
      monthlyWorks.length === 0
    ) {
      const { getSharedCatalogWorks, getPopularWorks, getWeeklyRankingWorks, getMonthlyRankingWorks } =
        await import("@/lib/works/catalog");
      const { mergeLiveStatusIntoItems } = await import(
        "@/lib/dmm/work-live-status"
      );
      const catalog = await getSharedCatalogWorks();
      const [p, w, m] = await Promise.all([
        mergeLiveStatusIntoItems(getPopularWorks(catalog, 10)),
        mergeLiveStatusIntoItems(getWeeklyRankingWorks(catalog, 10)),
        mergeLiveStatusIntoItems(getMonthlyRankingWorks(catalog, 10)),
      ]);
      if (popularWorks.length === 0) popularWorks = p;
      if (weeklyWorks.length === 0) weeklyWorks = w;
      if (monthlyWorks.length === 0) monthlyWorks = m;
    }

    const popularCards = toRankingWorkCardItems(popularWorks);
    const weeklyCards = toRankingWorkCardItems(weeklyWorks);
    const monthlyCards = toRankingWorkCardItems(monthlyWorks);
    const popularActresses = actressesResult.items.map((actress) => ({
      name: actress.name,
      slug: actress.slug,
      workCount: actress.workCount,
      imageUrl: actress.imageUrl,
      imageFromMultiActressWork: actress.imageFromMultiActressWork,
    }));
    const rankedMakers = makersResult.items;
    const rankedSeries = seriesResult.items;

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
            <PageIntro
              text={`${siteConfig.name}の人気作品・女優・メーカー・シリーズランキングです。週間・月間のトレンドも確認できます。`}
            />
          </header>

          <RankingNav current="/ranking" />

          <section aria-labelledby="rank-works" className="mb-12">
            <SectionHeader
              title="人気作品ランキング"
              id="rank-works"
              href="/ranking/works"
            />
            <DmmRankedWorkList items={popularCards} />
          </section>

          <section aria-labelledby="rank-weekly" className="mb-12">
            <SectionHeader
              title="週間ランキング"
              id="rank-weekly"
              href="/ranking/weekly"
            />
            <DmmRankedWorkList items={weeklyCards} />
          </section>

          <section aria-labelledby="rank-monthly" className="mb-12">
            <SectionHeader
              title="月間ランキング"
              id="rank-monthly"
              href="/ranking/monthly"
            />
            <DmmRankedWorkList items={monthlyCards} />
          </section>

          <section aria-labelledby="rank-actresses" className="mb-12">
            <SectionHeader
              title="人気女優ランキング"
              id="rank-actresses"
              href="/ranking/actresses"
            />
            {actressesResult.error ? (
              <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
            ) : popularActresses.length === 0 ? (
              <RankingEmptyState message="ランキングデータを集計中です" />
            ) : (
              <DmmActressCarousel
                actresses={popularActresses}
                id="rank-actresses-list"
              />
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="rank-makers">
              <SectionHeader
                title="人気メーカーランキング"
                id="rank-makers"
                href="/ranking/makers"
              />
              {makersResult.error ? (
                <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
              ) : (
                <RankedEntityList items={toMakerEntityCards(rankedMakers)} />
              )}
            </section>

            <section aria-labelledby="rank-series">
              <SectionHeader
                title="人気シリーズランキング"
                id="rank-series"
                href="/ranking/series"
              />
              {seriesResult.error ? (
                <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
              ) : (
                <RankedEntityList items={toSeriesEntityCards(rankedSeries)} />
              )}
            </section>
          </div>
        </PageLayout>
      </>
    );
  });
}
