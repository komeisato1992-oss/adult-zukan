import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import {
  RankedActressList,
  RankingEmptyState,
} from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPopularActresses } from "@/lib/ranking/entity-ranking-service";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 21600;

export const metadata = createPageMetadata({
  title: "人気女優ランキング",
  description: "アダルト図鑑の人気女優ランキングTOP30。公開中作品の実データから集計。",
  path: "/ranking/actresses",
});

export default async function RankingActressesPage() {
  const result = await getPopularActresses(30);
  const showScore = process.env.NODE_ENV !== "production";
  const actresses = result.items;

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "人気女優", path: "/ranking/actresses" },
          ]),
          createItemListJsonLd(
            "人気女優ランキング",
            actresses.map((actress) => ({
              name: actress.name,
              url: `${siteConfig.url}${actress.href}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "人気女優" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            人気女優ランキング
          </h1>
          <PageIntro text="公開中作品の出演数・人気スコア・新作出演をもとに集計した女優ランキングです。" />
        </header>
        <RankingNav current="/ranking/actresses" />
        {result.error ? (
          <RankingEmptyState message="ランキングを取得できませんでした。時間をおいて再度お試しください。" />
        ) : actresses.length === 0 ? (
          <RankingEmptyState message="ランキングデータを集計中です" />
        ) : (
          <RankedActressList actresses={actresses} showScore={showScore} />
        )}
      </PageLayout>
    </>
  );
}
