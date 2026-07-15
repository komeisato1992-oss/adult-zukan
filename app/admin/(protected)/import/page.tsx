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
          ①候補取得 → ②選択・追加 → ③更新 → ④本番反映。日常運用は管理画面だけで完結します。本番デプロイは④のみです。
        </p>
      </section>

      <ImportManagement />
    </div>
  );
}
