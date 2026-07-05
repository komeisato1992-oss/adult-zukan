import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedEntityList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getRankedSeriesWithCounts } from "@/lib/works/repository";

export const metadata = createPageMetadata({
  title: "人気シリーズランキング",
  description: "アダルト図鑑の人気シリーズランキングTOP20。",
  path: "/ranking/series",
});

export default async function RankingSeriesPage() {
  const rankedSeries = await getRankedSeriesWithCounts(20);

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
            rankedSeries.map(({ series }) => ({
              name: series.name,
              url: `${siteConfig.url}/series/${series.slug}`,
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
          <PageIntro text="作品数と人気度をもとに集計したシリーズランキングです。" />
        </header>
        <RankingNav current="/ranking/series" />
        <RankedEntityList
          items={rankedSeries.map(({ series, workCount }) => ({
            name: series.name,
            href: `/series/${series.slug}`,
            meta: `${workCount}作品`,
          }))}
        />
      </PageLayout>
    </>
  );
}
