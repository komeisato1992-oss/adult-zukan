import Link from "next/link";
import { DoujinDashboardKpiSection } from "@/components/admin/DoujinDashboardKpiSection";
import { DoujinSyncClient } from "@/components/admin/DoujinSyncClient";
import { getDoujinAdminDashboardStats } from "@/lib/admin/doujin-admin-stats";
import { doujinAdminNavItems } from "@/lib/admin/doujin-navigation";
import { readDoujinFloorEnv } from "@/lib/doujin/floor-config";
import { isDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";

export const dynamic = "force-dynamic";

function formatCount(value: number): string {
  return value.toLocaleString("ja-JP");
}

function formatDateTime(value: string | null): string {
  if (!value) return "未更新";
  return value.replace("T", " ").slice(0, 16);
}

const SHORTCUTS = [
  { href: "/admin/doujin/works", label: "作品一覧" },
  { href: "/admin/doujin/fetch", label: "データ追加" },
  { href: "/admin/doujin/api-diagnostic", label: "更新" },
  { href: "/admin/doujin/analytics", label: "SEO" },
] as const;

export default function DoujinAdminPage() {
  const stats = getDoujinAdminDashboardStats();
  const floorEnv = readDoujinFloorEnv();
  const writeAllowed = isDoujinLocalWriteAllowed();
  const menuItems = doujinAdminNavItems.filter((item) => !item.disabled);

  const primary = [
    { label: "作品数", value: formatCount(stats.workCount) },
    { label: "公開中", value: formatCount(stats.publishedCount) },
    { label: "セール中", value: formatCount(stats.saleCount) },
    {
      label: "最終更新",
      value: formatDateTime(stats.lastUpdatedAt),
      sub: `取得: ${formatDateTime(stats.lastFetchedAt)}`,
    },
  ];

  const secondary = [
    { label: "非公開", value: formatCount(stats.unpublishedCount) },
    { label: "サークル数", value: formatCount(stats.circleCount) },
    { label: "作者数", value: formatCount(stats.authorCount) },
    { label: "シリーズ数", value: formatCount(stats.seriesCount) },
    { label: "ジャンル数", value: formatCount(stats.genreCount) },
    {
      label: "フロアENV",
      value: floorEnv.floor || "未設定",
      sub: `${floorEnv.site || "-"} / ${floorEnv.service || "-"}`,
    },
  ];

  return (
    <div className="space-y-6 md:space-y-6" data-site-type="doujin">
      <div>
        <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold leading-tight text-foreground md:text-2xl">
          同人図鑑 ダッシュボード
        </h1>
        <p className="mt-1.5 text-sm leading-snug text-muted md:mt-2">
          同人図鑑の件数確認・作品追加・マスター確認を行います。成人図鑑データとは分離されています。
        </p>
      </div>

      {/* スマホ上部ショートカット */}
      <nav
        aria-label="よく使う操作"
        className="grid grid-cols-2 gap-2 md:hidden"
      >
        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-[#F78FA7] bg-white px-2 text-sm font-semibold text-[#e56b8a]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!writeAllowed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 md:px-4 md:py-3">
          <p className="font-medium">
            本番環境では作品データの直接更新はできません。
          </p>
          <p className="mt-1 text-xs md:text-sm">
            ローカル環境で同期・追加を実行し、JSONをGitへコミット・pushしてください。
          </p>
        </div>
      ) : null}

      <DoujinDashboardKpiSection primary={primary} secondary={secondary} />

      <section className="hidden md:block">
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

      {/* スマホではメニューはサイドバー＋ショートカット優先。同期は折りたたみ下へ */}
      <details className="rounded-xl border border-border bg-white md:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
          同期・その他メニュー
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-border px-2 text-center text-xs font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <DoujinSyncClient />
        </div>
      </details>

      <div className="hidden md:block">
        <DoujinSyncClient />
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3">
        <Link
          href="/admin"
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent md:h-10"
        >
          アダルト図鑑管理へ切替
        </Link>
        <Link
          href="/doujin"
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg bg-[#F78FA7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#e56b8a] md:h-10"
        >
          同人図鑑サイトを見る
        </Link>
      </div>
    </div>
  );
}
