import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedWorkList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getWeeklyRankedWorks } from "@/lib/works/repository";

export const metadata = createPageMetadata({
  title: "週間ランキング",
  description: "今週の人気作品週間ランキングTOP20。",
  path: "/ranking/weekly",
});

export default async function RankingWeeklyPage() {
  const works = await getWeeklyRankedWorks(20);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "週間ランキング", path: "/ranking/weekly" },
          ]),
          createItemListJsonLd(
            "週間ランキング",
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
            { label: "週間ランキング" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            週間ランキング
          </h1>
          <PageIntro text="直近1週間のアクセスと評価をもとに集計した週間人気作品ランキングです。" />
        </header>
        <RankingNav current="/ranking/weekly" />
        <RankedWorkList works={works} />
      </PageLayout>
    </>
  );
}
