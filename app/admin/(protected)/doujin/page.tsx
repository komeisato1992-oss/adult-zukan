import Link from "next/link";
import { DoujinSyncClient } from "@/components/admin/DoujinSyncClient";
import { readDoujinFloorEnv } from "@/lib/doujin/floor-config";
import { getDoujinCatalogStats } from "@/lib/doujin/upsert";
import { isDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";

export default function DoujinAdminPage() {
  const stats = getDoujinCatalogStats();
  const floorEnv = readDoujinFloorEnv();
  const writeAllowed = isDoujinLocalWriteAllowed();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">同人図鑑 管理画面</h1>
        <p className="mt-2 text-sm text-muted">
          同人作品のAPI診断・取得・件数確認を行います。公開サイトは非公開のままです。
        </p>
      </div>

      {!writeAllowed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            本番環境では作品データの直接更新はできません。
          </p>
          <p className="mt-1">
            ローカル環境で同期を実行し、JSONをGitへコミット・pushしてください。
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs">
            <li>ローカル環境で同期を実行</li>
            <li>検証コマンドを実行</li>
            <li>JSONとrawシャードの変更を確認</li>
            <li>Gitへコミット</li>
            <li>GitHubへpush</li>
            <li>Vercelのデプロイ完了後に公開ページを確認</li>
          </ol>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["取得済み作品数", stats.workCount],
          ["サークル数", stats.circleCount],
          ["作者数", stats.authorCount],
          ["シリーズ数", stats.seriesCount],
          ["ジャンル数", stats.genreCount],
          ["エラー件数", stats.errorCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-border bg-white p-4"
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-white p-4 sm:col-span-2">
          <p className="text-xs text-muted">最新取得日時</p>
          <p className="mt-1 text-sm font-medium">
            {stats.lastFetchedAt ?? "未取得"}
          </p>
          <p className="mt-2 text-xs text-muted">
            フロアENV: {floorEnv.site || "未設定"} /{" "}
            {floorEnv.service || "未設定"} / {floorEnv.floor || "未設定"}
          </p>
        </div>
      </section>

      <DoujinSyncClient />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/admin/doujin/api-diagnostic",
            label: "API診断",
            note: "フロア一覧・1件生JSON確認",
          },
          {
            href: "/admin/doujin/fetch",
            label: "作品取得",
            note: "20/50/100件取得と履歴",
          },
          {
            href: "/doujin/works",
            label: "作品一覧を確認",
            note: "同人図鑑フロント",
          },
        ].map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-border bg-white p-4 transition-colors hover:border-accent"
          >
            <p className="font-medium text-foreground">{section.label}</p>
            <p className="mt-1 text-xs text-muted">{section.note}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          アダルト図鑑管理画面へ戻る
        </Link>
        <Link
          href="/doujin"
          className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          同人図鑑サイトを見る
        </Link>
      </div>
    </div>
  );
}
