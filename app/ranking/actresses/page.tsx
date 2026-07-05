import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { RankedActressList } from "@/components/ranking/RankingList";
import { RankingNav } from "@/components/ranking/RankingNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { getRankedActresses } from "@/data/actresses";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createItemListJsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

export const metadata = createPageMetadata({
  title: "人気女優ランキング",
  description: "アダルト図鑑の人気女優ランキングTOP30。",
  path: "/ranking/actresses",
});

export default function RankingActressesPage() {
  const actresses = getRankedActresses(30);

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
              url: `${siteConfig.url}/actresses/${actress.slug}`,
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
          <PageIntro text="出演作品数と人気度をもとに集計した女優ランキングです。" />
        </header>
        <RankingNav current="/ranking/actresses" />
        <RankedActressList actresses={actresses} />
      </PageLayout>
    </>
  );
}
