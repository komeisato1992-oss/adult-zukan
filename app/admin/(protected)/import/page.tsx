import { ImportManagement } from "@/components/admin/ImportManagement";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-xl font-bold text-foreground sm:text-2xl">
          作品管理
        </h1>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          作品追加・掲載情報更新・公開管理・見放題管理・処理履歴。日常運用は管理画面とSupabaseだけで完結します。
        </p>
      </section>
      <ImportManagement />
    </div>
  );
}
