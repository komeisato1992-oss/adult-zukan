import Link from "next/link";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";

export const metadata = createPageMetadata({
  title: "アダルト図鑑とは",
  description: `${siteConfig.name}は、アダルト作品の情報をわかりやすく紹介するポータルサイトです。作品・女優・メーカー・ジャンルからお好みの作品を見つけられます。`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "アダルト図鑑とは", path: "/about" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "アダルト図鑑とは",
            description: siteConfig.description,
            url: `${siteConfig.url}/about`,
          },
        ]}
      />
      <LegalPageLayout title="アダルト図鑑とは" breadcrumbLabel="アダルト図鑑とは">
        <section>
          <h2 className="text-base font-bold text-foreground">サイトの目的</h2>
          <p>
            {siteConfig.name}は、アダルト作品の情報をわかりやすく整理・紹介するポータルサイトです。作品名・品番・女優名・メーカー名・ジャンル名から作品を探し、詳細情報を確認できることを目的としています。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">作品を探しやすくするサイト</h2>
          <p>
            当サイトでは、100件以上の作品情報に加え、女優30名、メーカー20社、レーベル20件、シリーズ30件、ジャンル20種類のデータを掲載しています。人気ランキング・新着情報・セール情報・横断検索機能により、効率よく作品を見つけられます。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">購入・視聴について</h2>
          <p>
            作品の購入・視聴・ダウンロードは、FANZA（DMM）等の公式配信サイトにて行ってください。当サイトは作品情報の紹介のみを行い、決済や配信は行いません。各作品ページのリンクから公式サイトへ移動し、最新の価格・内容をご確認のうえお求めください。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">アフィリエイト広告について</h2>
          <p>
            当サイトは、アフィリエイトプログラム（FANZAアフィリエイト等）を利用して商品を紹介しています。リンク経由で公式サイトへ移動し、商品が購入された場合、当サイトに紹介料が発生することがあります。商品の価格や内容に変更はなく、ユーザー様に追加費用が発生することはありません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground">関連ページ</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/faq" className="text-accent hover:underline">
                よくある質問（FAQ）
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-accent hover:underline">
                利用規約
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-accent hover:underline">
                お問い合わせ
              </Link>
            </li>
          </ul>
        </section>
      </LegalPageLayout>
    </>
  );
}
