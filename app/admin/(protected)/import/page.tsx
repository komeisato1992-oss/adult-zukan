import { ImportManagement } from "@/components/admin/ImportManagement";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品追加管理
        </h1>
        <p className="mt-2 text-sm text-muted">
          FANZA から未掲載候補を蓄積し、管理画面から段階的に本番カタログへ追加できます。
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">Version 2 運用</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>「候補を収集」で FANZA から最大200件ずつ未掲載候補を蓄積</li>
          <li>候補一覧は import-candidates.json から表示（ページ表示時に FANZA API は叩かない）</li>
          <li>候補をチェックで選択し、「選択した作品を一括追加」で GitHub へ1回だけ commit</li>
          <li>1ページ100件 / 1回の一括追加は最大1000件まで（追加数は100・200・500・1000・選択中すべてから選択）</li>
          <li>追加後、Vercel の自動デプロイで本番反映（数分・デプロイは1回）</li>
          <li>追加・除外後は候補ステータスを更新し、次回以降表示しない</li>
        </ul>
      </section>

      <ImportManagement />
    </div>
  );
}
