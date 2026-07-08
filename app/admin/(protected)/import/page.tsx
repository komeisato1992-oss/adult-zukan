import { ImportManagement } from "@/components/admin/ImportManagement";

export default function AdminImportPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          作品追加管理
        </h1>
        <p className="mt-2 text-sm text-muted">
          FANZAから未掲載の候補作品を取得し、追加用JSONの生成やSNS投稿文の作成ができます。
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">Version 1 の運用</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>「追加する」で生成したJSONを `data/dmm/catalog-snapshot.json` に手動追加</li>
          <li>SNS投稿は生成・コピー・Xで開くのみ（自動投稿なし）</li>
          <li>掲載済み `content_id` は候補から自動除外</li>
        </ul>
      </section>

      <ImportManagement />
    </div>
  );
}
