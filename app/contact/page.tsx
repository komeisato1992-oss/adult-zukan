import Link from "next/link";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { siteConfig } from "@/lib/site-config";
import { SITE_URL } from "@/lib/constants";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "お問い合わせ",
  description: `${siteConfig.name}へのお問い合わせ方法をご案内します。`,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalPageLayout title="お問い合わせ" breadcrumbLabel="お問い合わせ">
      <p>
        {siteConfig.name}に関するお問い合わせは、下記の方法にて受け付けております。内容を確認のうえ、順次ご返信いたします。
      </p>

      <section>
        <h2 className="text-base font-bold text-foreground">お問い合わせ方法</h2>
        <p>
          現在、お問い合わせはメールにて受け付けております。以下の内容を明記のうえ、メールにてご連絡ください。
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>お名前（ニックネーム可）</li>
          <li>返信用メールアドレス</li>
          <li>お問い合わせ内容</li>
        </ul>
        <p className="mt-4">
          メールアドレス：
          <a
            href={`mailto:info@${new URL(SITE_URL).hostname}`}
            className="text-accent hover:underline"
          >
            info@{new URL(SITE_URL).hostname}
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">ご注意</h2>
        <p>
          作品の配信状況、価格、視聴方法等については、各配信サービスの公式サポートへお問い合わせください。当サイトからリンクされる外部サービスに関する契約・決済・返品等は、各サービスの規約が適用されます。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">関連ページ</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/terms" className="text-accent hover:underline">
              利用規約
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="text-accent hover:underline">
              プライバシーポリシー
            </Link>
          </li>
          <li>
            <Link href="/age-restriction" className="text-accent hover:underline">
              18歳未満閲覧禁止
            </Link>
          </li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
