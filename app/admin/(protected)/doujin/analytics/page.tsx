import Link from "next/link";
import { getDoujinAnalyticsSnapshot } from "@/lib/admin/doujin-analytics";
import { formatSeoDateTime, formatSeoNumber } from "@/components/admin/seo/format";

export const dynamic = "force-dynamic";

export default async function DoujinAnalyticsAdminPage() {
  const data = await getDoujinAnalyticsSnapshot();

  return (
    <div className="space-y-6" data-site-type="doujin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-[#F78FA7] pl-3 text-2xl font-bold">
            同人図鑑 Search Console / GA4
          </h1>
          <p className="mt-2 text-sm text-muted">{data.note}</p>
        </div>
        <Link
          href="/admin/doujin"
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm"
        >
          ダッシュボードへ
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted">GSC クリック（/doujin上位）</p>
          <p className="mt-1 text-2xl font-bold">
            {formatSeoNumber(data.seo.totalClicksFromTop)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted">GSC 表示（/doujin上位）</p>
          <p className="mt-1 text-2xl font-bold">
            {formatSeoNumber(data.seo.totalImpressionsFromTop)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted">GA4 PV（/doujin上位）</p>
          <p className="mt-1 text-2xl font-bold">
            {formatSeoNumber(data.ga4.totalPageViewsFromTop)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs text-muted">キャッシュ更新</p>
          <p className="mt-1 text-sm font-medium">
            GSC: {formatSeoDateTime(data.seo.updatedAt ?? null)}
          </p>
          <p className="mt-1 text-sm font-medium">
            GA4:{" "}
            {formatSeoDateTime(
              data.ga4.lastSuccessfulAt ?? data.ga4.updatedAt ?? null,
            )}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Search Console 人気ページ（/doujin）</h2>
        {data.seo.fetchError ? (
          <p className="mt-2 text-sm text-amber-700">{data.seo.fetchError}</p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2">URL</th>
                <th className="py-2">クリック</th>
                <th className="py-2">表示</th>
                <th className="py-2">CTR</th>
                <th className="py-2">順位</th>
              </tr>
            </thead>
            <tbody>
              {data.seo.topPages.map((row) => (
                <tr key={row.url} className="border-t border-border">
                  <td className="max-w-[420px] truncate py-2">{row.url}</td>
                  <td className="py-2">{formatSeoNumber(row.clicks)}</td>
                  <td className="py-2">{formatSeoNumber(row.impressions)}</td>
                  <td className="py-2">
                    {(row.ctr * 100).toFixed(1)}%
                  </td>
                  <td className="py-2">{row.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.seo.topPages.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              /doujin 配下のページがキャッシュにありません。成人図鑑側で Search Console
              を更新後に再読み込みしてください。
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">GA4 人気ページ（/doujin）</h2>
        {data.ga4.fetchError ? (
          <p className="mt-2 text-sm text-amber-700">{data.ga4.fetchError}</p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2">path</th>
                <th className="py-2">PV</th>
                <th className="py-2">ユーザー</th>
                <th className="py-2">平均エンゲージメント秒</th>
              </tr>
            </thead>
            <tbody>
              {data.ga4.topPages.map((row) => (
                <tr key={row.path} className="border-t border-border">
                  <td className="max-w-[420px] truncate py-2">{row.path}</td>
                  <td className="py-2">{formatSeoNumber(row.pageViews)}</td>
                  <td className="py-2">{formatSeoNumber(row.users)}</td>
                  <td className="py-2">
                    {row.avgEngagementSeconds.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.ga4.topPages.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              /doujin 配下のページがキャッシュにありません。成人図鑑側で GA4 を更新後に再読み込みしてください。
            </p>
          ) : null}
        </div>
      </section>

      <p className="text-xs text-muted" id="dmm">
        DMM成果は現時点でサイト別識別子が無いため、同人単独の成果として確定できません。
        成人図鑑の DMM タブを参照し、推定値と確定値を混同しないでください。
        将来的にアフィリエイトID／トラッキングIDを site_type 別に分離できる構造にします。
      </p>
    </div>
  );
}
