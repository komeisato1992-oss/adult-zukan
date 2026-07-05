import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedWorkList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";
import { getRankedWorks } from "@/lib/works/repository";

export const metadata = createPageMetadata({
  title: "人気作品ランキング",
  description: "アダルト図鑑の人気作品ランキングTOP100。",
  path: "/ranking/works",
});

export default async function RankingWorksPage() {
  const works = await getRankedWorks(100);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "ランキング", path: "/ranking" },
            { name: "人気作品", path: "/ranking/works" },
          ]),
          createItemListJsonLd(
            "人気作品ランキング",
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
            { label: "人気作品" },
          ]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            人気作品ランキング
          </h1>
          <PageIntro text="視聴者の評価とアクセス数をもとに集計した人気作品ランキングです。" />
        </header>
        <RankingNav current="/ranking/works" />
        <RankedWorkList works={works} />
      </PageLayout>
    </>
  );
}
