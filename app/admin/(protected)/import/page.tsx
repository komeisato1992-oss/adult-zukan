import { ImportManagement } from "@/components/admin/ImportManagement";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品管理
        </h1>
        <p className="mt-2 text-sm text-muted">
          未掲載作品の追加と、掲載済み作品の更新は作業用ブランチへ保存します。本番反映は最後に1回だけ実行します。
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">3つのフロー</p>
        <ul className="mt-2 list-inside list-disc space-y-2">
          <li>
            <strong className="text-foreground">掲載作品を最新に更新</strong>
            ：掲載中作品の価格・セール・評価等を更新します。変更は作業用ブランチへ保存されます。
          </li>
          <li>
            <strong className="text-foreground">A. 未掲載作品を取得・追加</strong>
            ：FANZA人気順または新着順から候補を取得し、選択作品を作業用ブランチへ追加します。
          </li>
          <li>
            <strong className="text-foreground">本番反映・デプロイ</strong>
            ：すべての追加・更新作業が終わったあと、変更をmainへまとめて反映し、Productionデプロイを1回実行します。
          </li>
        </ul>
        <p className="mt-4 rounded-md bg-amber-500/15 px-3 py-2 font-medium text-amber-950 dark:text-amber-50">
          作品追加や更新だけでは本番サイトへ反映されません。
        </p>
      </section>

      <ImportManagement />
    </div>
  );
}
