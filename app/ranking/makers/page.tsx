import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  RankedEntityList,
  RankingEmptyState,
  toMakerEntityCards,
} from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getPopularMakers } from "@/lib/ranking/entity-ranking-service";

export const revalidate = 21600;

export const metadata = createPageMetadata({
  title: "人気メーカーランキング",
  description: "アダルト図鑑の人気メーカーランキングTOP30。公開中作品の実データから集計。",
  path: "/ranking/makers",
});

export default async function RankingMakersPage() {
  const result = await getPopularMakers(30);
  const showScore = process.env.NODE_ENV !== "production";
  const rankedMakers = result.items;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "人気メーカー", path: "/ranking/makers" },
          ]),
          createItemListJsonLd(
            "人気メーカーランキング",
            rankedMakers.map((maker) => ({
              name: maker.name,
              url: `${siteConfig.url}${maker.href}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "人気メーカー" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            人気メーカーランキング
          </h1>
          <PageIntro text="公開中作品数と人気スコアをもとに集計したメーカーランキングです。" />
        </header>
        <RankingNav current="/ranking/makers" />
        {result.error ? (
          <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
        ) : rankedMakers.length === 0 ? (
          <RankingEmptyState message="ランキングデータを集計中です" />
        ) : (
          <RankedEntityList
            items={toMakerEntityCards(rankedMakers, showScore)}
          />
        )}
      </PageLayout>
    </>
  );
}
