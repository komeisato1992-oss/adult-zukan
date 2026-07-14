import Link from "next/link";
import { DoujinSyncClient } from "@/components/admin/DoujinSyncClient";
import { getDoujinAdminDashboardStats } from "@/lib/admin/doujin-admin-stats";
import { doujinAdminNavItems } from "@/lib/admin/doujin-navigation";
import { readDoujinFloorEnv } from "@/lib/doujin/floor-config";
import { isDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";

export const dynamic = "force-dynamic";

export default function DoujinAdminPage() {
  const stats = getDoujinAdminDashboardStats();
  const floorEnv = readDoujinFloorEnv();
  const writeAllowed = isDoujinLocalWriteAllowed();
  const menuItems = doujinAdminNavItems.filter((item) => !item.disabled);

  return (
    <div className="space-y-6" data-site-type="doujin">
      <div>
        <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold text-foreground">
          同人図鑑 ダッシュボード
        </h1>
        <p className="mt-2 text-sm text-muted">
          同人図鑑の件数確認・作品追加・マスター確認を行います。成人図鑑データとは分離されています。
        </p>
      </div>

      {!writeAllowed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            本番環境では作品データの直接更新はできません。
          </p>
          <p className="mt-1">
            ローカル環境で同期・追加を実行し、JSONをGitへコミット・pushしてください。
          </p>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["作品数", stats.workCount],
          ["公開中", stats.publishedCount],
          ["非公開", stats.unpublishedCount],
          ["セール中", stats.saleCount],
          ["サークル数", stats.circleCount],
          ["作者数", stats.authorCount],
          ["シリーズ数", stats.seriesCount],
          ["ジャンル数", stats.genreCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">
              {Number(value).toLocaleString("ja-JP")}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:col-span-2">
          <p className="text-xs text-muted">最終データ更新</p>
          <p className="mt-1 text-sm font-medium">
            {stats.lastUpdatedAt ?? "未更新"}
          </p>
          <p className="mt-2 text-xs text-muted">
            最終取得: {stats.lastFetchedAt ?? "未取得"}
          </p>
          <p className="mt-1 text-xs text-muted">
            フロアENV: {floorEnv.site || "未設定"} /{" "}
            {floorEnv.service || "未設定"} / {floorEnv.floor || "未設定"}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">管理メニュー</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-[#F78FA7]"
            >
              <p className="font-medium text-foreground">
                <span className="mr-2" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <DoujinSyncClient />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          アダルト図鑑管理へ切替
        </Link>
        <Link
          href="/doujin"
          className="inline-flex h-10 items-center rounded-lg bg-[#F78FA7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#e56b8a]"
        >
          同人図鑑サイトを見る
        </Link>
      </div>
    </div>
  );
}
