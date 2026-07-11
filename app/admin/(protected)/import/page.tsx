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
          FANZA から候補を取得し、確認・選択した作品だけをカタログへ追加します。
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-foreground">簡易インポート</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>FANZA人気順から未掲載作品を優先取得（掲載済みは候補に表示しません）</li>
          <li>候補取得は読み取り専用（GitHub へ書き込みません）</li>
          <li>未掲載候補の目標件数は 10〜500 件から選択（初期値 50 件）</li>
          <li>offset は localStorage に保存（GitHub へ保存しません）</li>
          <li>選択した作品だけを追加 API へ送信（allMatching は使いません）</li>
          <li>追加時のみ最新カタログを再取得し、GitHub へ 1 回 commit</li>
        </ul>
      </section>

      <ImportManagement />
    </div>
  );
}
