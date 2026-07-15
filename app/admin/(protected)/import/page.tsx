import { ImportManagement } from "@/components/admin/ImportManagement";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品管理
        </h1>
        <p className="mt-2 text-sm text-muted">
          上から順に進めるだけで完了します。追加・同期は作業ブランチのみ。本番反映ボタンでのみデプロイします。
        </p>
      </section>

      <ImportManagement />
    </div>
  );
}
