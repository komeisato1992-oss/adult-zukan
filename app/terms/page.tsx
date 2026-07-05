import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";

export const metadata = createPageMetadata({
  title: "利用規約",
  description: `${siteConfig.name}の利用規約です。当サイトのサービス利用条件、年齢制限、アフィリエイトに関する事項、免責事項等を定めています。ご利用前に必ずお読みください。`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={createBreadcrumbJsonLd([
          { name: "トップ", path: "/" },
          { name: "利用規約", path: "/terms" },
        ])}
      />
      <LegalPageLayout title="利用規約" breadcrumbLabel="利用規約">
      <p>最終更新日：2026年7月6日</p>

      <section>
        <h2 className="text-base font-bold text-foreground">第1条（適用）</h2>
        <p>
          本規約は、{siteConfig.name}（以下「当サイト」）が提供するサービスの利用条件を定めるものです。ユーザーは、当サイトを利用することにより、本規約に同意したものとみなされます。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第2条（年齢制限）</h2>
        <p>
          当サイトは18歳以上の方を対象とした情報提供サイトです。18歳未満の方の閲覧・利用を禁止します。ユーザーは、自己が18歳以上であることを確認のうえ、当サイトを利用するものとします。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第3条（サービス内容）</h2>
        <p>
          当サイトは、アダルト作品に関する情報の紹介、検索、一覧表示等を行うポータルサイトです。作品の視聴・購入は、当サイトからリンクされる外部の配信サービス上で行われます。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第4条（アフィリエイトプログラム）</h2>
        <p>
          当サイトは、アフィリエイトプログラムを利用し、外部サービスへのリンクを掲載しています。ユーザーが当サイト経由で外部サービスを利用した場合、当サイト運営者に紹介料が発生する場合があります。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第5条（禁止事項）</h2>
        <p>
          ユーザーは、法令または公序良俗に反する行為、当サイトの運営を妨害する行為、不正アクセス、コンテンツの無断転載・複製、その他当サイト運営者が不適切と判断する行為を行ってはなりません。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第6条（免責事項）</h2>
        <p>
          当サイトに掲載される作品情報、価格、配信状況等は、外部サービスの情報に基づくものであり、正確性・完全性を保証するものではありません。外部サービスの利用により生じた損害について、当サイト運営者は一切の責任を負いません。
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-foreground">第7条（規約の変更）</h2>
        <p>
          当サイト運営者は、必要に応じて本規約を変更できるものとします。変更後の規約は、当サイト上に掲載した時点で効力を生じます。
        </p>
      </section>
      </LegalPageLayout>
    </>
  );
}
