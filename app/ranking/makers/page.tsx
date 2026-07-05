import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedEntityList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getRankedMakersWithCounts } from "@/lib/works/repository";

export const metadata = createPageMetadata({
  title: "人気メーカーランキング",
  description: "アダルト図鑑の人気メーカーランキングTOP20。",
  path: "/ranking/makers",
});

export default async function RankingMakersPage() {
  const rankedMakers = await getRankedMakersWithCounts(20);

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
            rankedMakers.map(({ maker }) => ({
              name: maker.name,
              url: `${siteConfig.url}/makers/${maker.slug}`,
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
          <PageIntro text="作品数と人気度をもとに集計したメーカーランキングです。" />
        </header>
        <RankingNav current="/ranking/makers" />
        <RankedEntityList
          items={rankedMakers.map(({ maker, workCount }) => ({
            name: maker.name,
            href: `/makers/${maker.slug}`,
            meta: `${workCount}作品`,
          }))}
        />
      </PageLayout>
    </>
  );
}
