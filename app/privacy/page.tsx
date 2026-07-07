import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "プライバシーポリシー",
  description: `${siteConfig.name}のプライバシーポリシーです。`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="プライバシーポリシー" breadcrumbLabel="プライバシーポリシー">
      <p>最終更新日：2026年7月6日</p>

      <section>
        <h2 className="text-base font-bold text-foreground">1. 基本方針</h2>
        <p>
          {siteConfig.name}（以下「当サイト」）は、ユーザーの個人情報の保護を重要視し、個人情報の保護に関する法令等を遵守します。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">2. 収集する情報</h2>
        <p>
          当サイトでは、お問い合わせフォームの利用時に、メールアドレス、お名前（任意）、お問い合わせ内容等を取得する場合があります。また、アクセス解析のため、Cookieおよび類似技術を利用して、閲覧ページ、参照元、ブラウザ情報等の匿名データを取得する場合があります。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">3. 利用目的</h2>
        <p>
          取得した情報は、お問い合わせへの対応、サイトの改善、利用状況の分析、不正利用の防止のために利用します。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">4. 第三者提供</h2>
        <p>
          当サイトは、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。ただし、アクセス解析ツール（Google Analytics等）の利用により、匿名化されたデータが解析事業者に送信される場合があります。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">5. 外部リンク</h2>
        <p>
          当サイトからリンクされる外部サイトには、それぞれ独自のプライバシーポリシーが適用されます。外部サイトでの個人情報の取り扱いについて、当サイトは責任を負いません。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">アフィリエイトプログラムについて</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>当サイトではDMMアフィリエイト等のアフィリエイトプログラムを利用しています。</li>
          <li>商品・サービスの購入等に応じて紹介料を受け取る場合があります。</li>
          <li>掲載内容は運営者の判断で紹介しています。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">7. お問い合わせ</h2>
        <p>
          個人情報の取り扱いに関するお問い合わせは、当サイトのお問い合わせページよりご連絡ください。
        </p>
      </section>
    </LegalPageLayout>
  );
}
