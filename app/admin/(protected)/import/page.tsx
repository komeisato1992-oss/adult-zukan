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
          未掲載作品の追加と、掲載済み作品のFANZA同期（価格・セール・販売状態）を分けて実行します。
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">2つの独立したフロー</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">掲載作品を最新に更新</strong>
            ：全掲載作品のFANZA同期（バックグラウンドジョブ・優先順位付き）
          </li>
          <li>
            <strong className="text-foreground">A. 未掲載作品を取得・追加</strong>
            ：FANZA人気順から未掲載作品だけ候補取得 → 選択した作品のみ追加
          </li>
          <li>
            <strong className="text-foreground">B. 掲載済み作品の部分更新</strong>
            ：カタログ既存作品の価格・セール・販売状態のみ更新（新規追加なし）
          </li>
          <li>追加・更新とも GitHub へ 1 バッチ 1 commit</li>
          <li>同期ジョブ状態は fanza-sync-job.json に保存</li>
        </ul>
      </section>

      <ImportManagement />
    </div>
  );
}
