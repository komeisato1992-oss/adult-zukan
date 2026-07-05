import Link from "next/link";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata = createPageMetadata({
  title: "18歳未満閲覧禁止",
  description: `${siteConfig.name}は18歳以上の方を対象としたサイトです。`,
  path: "/age-restriction",
});

export default function AgeRestrictionPage() {
  return (
    <LegalPageLayout title="18歳未満閲覧禁止" breadcrumbLabel="18歳未満閲覧禁止">
      <div className="rounded-lg border-2 border-accent bg-accent-light p-6 text-center">
        <p className="text-2xl font-bold text-accent">18歳未満 閲覧禁止</p>
        <p className="mt-2 text-sm text-muted">
          Adults Only — 18+ Required
        </p>
      </div>

      <section>
        <h2 className="text-base font-bold text-foreground">年齢確認について</h2>
        <p>
          {siteConfig.name}は、18歳以上の方を対象としたアダルト作品情報サイトです。18歳未満の方の閲覧・利用を固くお断りします。当サイトを利用する際は、ご自身が18歳以上であることを確認してください。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">保護者の方へ</h2>
        <p>
          未成年者のインターネット利用については、フィルタリングソフトの導入や、保護者の方による適切な監督をお願いいたします。当サイトは、アダルトコンテンツへのリンクを含む情報提供サイトです。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">関連リンク</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/terms" className="text-accent hover:underline">
              利用規約
            </Link>
          </li>
          <li>
            <Link href="/" className="text-accent hover:underline">
              トップページへ戻る
            </Link>
          </li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
