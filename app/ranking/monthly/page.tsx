import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedWorkList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getMonthlyRankedWorks } from "@/lib/works/repository";

export const metadata = createPageMetadata({
  title: "月間ランキング",
  description: "今月の人気作品月間ランキングTOP20。",
  path: "/ranking/monthly",
});

export default async function RankingMonthlyPage() {
  const works = await getMonthlyRankedWorks(20);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "月間ランキング", path: "/ranking/monthly" },
          ]),
          createItemListJsonLd(
            "月間ランキング",
            works.map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.slug}`,
            })),
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "ランキング", href: "/ranking" },
            { label: "月間ランキング" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            月間ランキング
          </h1>
          <PageIntro text="直近1ヶ月のアクセスと評価をもとに集計した月間人気作品ランキングです。" />
        </header>
        <RankingNav current="/ranking/monthly" />
        <RankedWorkList works={works} />
      </PageLayout>
    </>
  );
}
