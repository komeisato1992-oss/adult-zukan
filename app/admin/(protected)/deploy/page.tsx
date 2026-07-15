import { CatalogPromotePanel } from "@/components/admin/CatalogPromotePanel";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { isAdultLocalWriteAllowed } from "@/lib/dmm/write-guard";

export const dynamic = "force-dynamic";

/**
 * コード変更時のみ使う本番反映ページ。
 * 作品データ追加・価格更新・見放題判定では使わない。
 */
export default function AdminDeployPage() {
  const configured =
    isGitHubCatalogConfigured() || isAdultLocalWriteAllowed();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          デプロイ・本番反映（コード変更時のみ）
        </h1>
        <p className="mt-2 text-sm text-muted">
          UI・コード・CSS・機能変更を本番へ反映するときだけ使います。作品の追加・価格・セール・評価・順位・販売終了・見放題判定の更新では不要です（Supabaseへ直接保存・デプロイなし）。
        </p>
      </section>
      <CatalogPromotePanel configured={configured} />
    </div>
  );
}
