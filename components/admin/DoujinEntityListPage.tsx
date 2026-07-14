import Link from "next/link";
import { listDoujinEntitiesForAdmin } from "@/lib/admin/doujin-works-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Kind = "circles" | "authors" | "series" | "genres";

const LABELS: Record<Kind, string> = {
  circles: "サークル",
  authors: "作者",
  series: "シリーズ",
  genres: "ジャンル",
};

export async function DoujinEntityListPage({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: PageProps["searchParams"];
}) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const rows = listDoujinEntitiesForAdmin(kind, q);
  const label = LABELS[kind];
  const href = `/admin/doujin/${kind}`;

  return (
    <div className="space-y-4" data-site-type="doujin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold">
            {label}管理
          </h1>
          <p className="mt-2 text-sm text-muted">
            {rows.length.toLocaleString("ja-JP")}件
          </p>
        </div>
        <Link
          href="/admin/doujin"
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm"
        >
          ダッシュボードへ
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action={href} method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder={`${label}名で検索`}
          className="h-10 min-w-[16rem] flex-1 rounded-lg border border-border px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          検索
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-[640px] w-full border-collapse text-left text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">作品数</th>
              <th className="px-3 py-2">更新日時</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-xs text-muted">{row.id}</td>
                <td className="px-3 py-2">{row.workCount}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {row.updatedAt.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
