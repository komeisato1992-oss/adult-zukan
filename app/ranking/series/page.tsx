import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  RankedEntityList,
  RankingEmptyState,
  toSeriesEntityCards,
} from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getPopularSeries } from "@/lib/ranking/entity-ranking-service";

export const revalidate = 21600;

export const metadata = createPageMetadata({
  title: "人気シリーズランキング",
  description: "アダルト図鑑の人気シリーズランキングTOP30。公開中作品の実データから集計。",
  path: "/ranking/series",
});

export default async function RankingSeriesPage() {
  const result = await getPopularSeries(30);
  const showScore = process.env.NODE_ENV !== "production";
  const rankedSeries = result.items;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "人気シリーズ", path: "/ranking/series" },
          ]),
          createItemListJsonLd(
            "人気シリーズランキング",
            rankedSeries.map((series) => ({
              name: series.name,
              url: `${siteConfig.url}${series.href}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "人気シリーズ" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            人気シリーズランキング
          </h1>
          <PageIntro text="公開中作品数と人気スコアをもとに集計したシリーズランキングです。" />
        </header>
        <RankingNav current="/ranking/series" />
        {result.error ? (
          <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
        ) : rankedSeries.length === 0 ? (
          <RankingEmptyState message="ランキングデータを集計中です" />
        ) : (
          <RankedEntityList
            items={toSeriesEntityCards(rankedSeries, showScore)}
          />
        )}
      </PageLayout>
    </>
  );
}
