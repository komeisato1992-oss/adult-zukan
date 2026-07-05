import Link from "next/link";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd, createFaqJsonLd } from "@/lib/seo/json-ld";

const faqItems = [
  {
    question: "このサイトについて教えてください",
    answer: `${siteConfig.name}は、アダルト作品の情報を整理・紹介するポータルサイトです。作品・女優・メーカー・シリーズ・ジャンルから作品を探し、ランキングや検索機能で効率よく情報を確認できます。`,
  },
  {
    question: "作品の購入方法を教えてください",
    answer:
      "作品の購入・視聴はFANZA（DMM）等の公式配信サイトで行います。各作品ページの「公式サイトで見る」ボタンから外部サイトへ移動し、最新の価格と内容をご確認のうえお求めください。当サイトでは決済や配信は行いません。",
  },
  {
    question: "18歳未満でも利用できますか",
    answer:
      "いいえ。当サイトは18歳以上の方を対象としたサイトです。18歳未満の方の閲覧・利用を固くお断りします。初回アクセス時に年齢確認を行っており、18歳未満と回答された場合は閲覧できません。",
  },
  {
    question: "掲載されている作品情報は正確ですか",
    answer:
      "当サイトの作品情報は、公開情報およびAPI連携データをもとに掲載しています。ただし、価格・在庫・配信状況等は公式サイトの情報が最新です。購入前には必ず公式サイトで最新情報をご確認ください。",
  },
  {
    question: "リンクについて教えてください",
    answer:
      "当サイト内の作品リンクの多くは、FANZA等の公式配信サイトへのアフィリエイトリンクです。リンク経由での購入により、当サイトに紹介料が発生する場合があります。ユーザー様への追加費用は発生しません。",
  },
] as const;

export const metadata = createPageMetadata({
  title: "よくある質問（FAQ）",
  description: `${siteConfig.name}に関するよくある質問。サイトの目的、購入方法、18歳未満の利用、作品情報、リンクについて。`,
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          createFaqJsonLd([...faqItems]),
        ]}
      />
      <LegalPageLayout title="よくある質問（FAQ）" breadcrumbLabel="FAQ">
        <div className="space-y-8">
          {faqItems.map((item) => (
            <section key={item.question}>
              <h2 className="text-base font-bold text-foreground">Q. {item.question}</h2>
              <p className="mt-2">A. {item.answer}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 border-t border-border pt-6">
          <p>
            その他のご質問は
            <Link href="/contact" className="mx-1 text-accent hover:underline">
              お問い合わせページ
            </Link>
            よりご連絡ください。
          </p>
        </section>
      </LegalPageLayout>
    </>
  );
}
