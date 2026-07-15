import { ImportManagement } from "@/components/admin/ImportManagement";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品管理 CMS
        </h1>
        <p className="mt-2 text-sm text-muted">
          追加・掲載更新・公開管理・履歴。日常運用は管理画面とSupabaseだけで完結します。Git差分・デプロイ・本番反映ボタンは不要です。
        </p>
      </section>
      <ImportManagement />
    </div>
  );
}
