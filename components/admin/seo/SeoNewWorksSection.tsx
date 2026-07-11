"use client";

import {
  formatSeoDateTime,
  formatSeoNumber,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import { SeoKpiCard } from "@/components/admin/seo/SeoKpiCard";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type { SeoCachePayload, SeoNewWorkStatus } from "@/lib/admin/seo-types";

type SeoNewWorksSectionProps = {
  data: SeoCachePayload;
};

const STATUS_LABELS: Record<SeoNewWorkStatus, string> = {
  has_search_data: "検索表示あり",
  no_search_data: "まだ検索データなし",
  pending: "確認待ち",
};

export function SeoNewWorksSection({ data }: SeoNewWorksSectionProps) {
  const { newWorks } = data;

  return (
    <section className="space-y-4">
      <SeoSectionHeading
        title="新規作品のGoogle登録状況"
        description="インデックス登録と検索表示実績は別指標です"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <SeoKpiCard
          label="直近7日追加"
          value={formatSeoNumber(newWorks.added7d)}
        />
        <SeoKpiCard
          label="直近28日追加"
          value={formatSeoNumber(newWorks.added28d)}
        />
        <SeoKpiCard
          label="検索データ確認済"
          value={formatSeoNumber(newWorks.withSearchData)}
        />
        <SeoKpiCard
          label="未確認"
          value={formatSeoNumber(newWorks.withoutSearchData)}
        />
      </div>

      {newWorks.rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          直近28日に追加された作品はありません。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">作品タイトル</th>
                <th className="px-3 py-3 font-medium">追加日</th>
                <th className="px-3 py-3 font-medium">表示回数</th>
                <th className="px-3 py-3 font-medium">クリック</th>
                <th className="px-3 py-3 font-medium">平均順位</th>
                <th className="px-3 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {newWorks.rows.map((row) => (
                <tr key={row.contentId}>
                  <td className="px-3 py-3">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      {row.title}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {formatSeoDateTime(row.addedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {row.status === "pending"
                      ? "—"
                      : formatSeoNumber(row.impressions)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {row.status === "pending"
                      ? "—"
                      : formatSeoNumber(row.clicks)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {row.status === "has_search_data"
                      ? formatSeoPosition(row.position)
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {STATUS_LABELS[row.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
