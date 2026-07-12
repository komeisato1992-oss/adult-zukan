"use client";

import { useMemo } from "react";
import { OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  ChangeBadge,
  OpsKpiCard,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/ops/OpsShared";
import {
  OpsDataStatusBanner,
  OpsEmptyState,
  OpsPeriodButtons,
  OpsSectionCard,
} from "@/components/admin/ops/OpsUi";
import {
  deriveSeoDataStatus,
  metricsFromDaily,
  resolveGscMetrics,
} from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsDashboardPayload, OpsGscPeriod } from "@/lib/admin/ops-types";

const GSC_PERIODS: Array<{ id: OpsGscPeriod; label: string }> = [
  { id: "1", label: "24時間" },
  { id: "7", label: "7日" },
  { id: "28", label: "28日" },
  { id: "90", label: "90日" },
];

type OpsSearchConsoleTabProps = {
  data: OpsDashboardPayload;
  period: OpsGscPeriod;
  onPeriodChange: (period: OpsGscPeriod) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

export function OpsSearchConsoleTab({
  data,
  period,
  onPeriodChange,
  refreshing,
  onRefresh,
}: OpsSearchConsoleTabProps) {
  const status = deriveSeoDataStatus(data.seo, refreshing, formatSeoDateTime);
  const { current, previous } = useMemo(
    () => resolveGscMetrics(data.seo, period),
    [data.seo, period],
  );
  const dayMetrics = useMemo(
    () => ({
      current: metricsFromDaily(data.seo.dailyStats, 1),
      previous: metricsFromDaily(data.seo.dailyStats, 1, 1),
    }),
    [data.seo.dailyStats],
  );
  const weekMetrics = data.seo.periods[7];
  const monthMetrics = data.seo.periods[28];
  const queries =
    period === "1"
      ? data.seo.periods[7]?.queries ?? []
      : data.seo.periods[Number(period) as 7 | 28 | 90]?.queries ?? [];
  const pages =
    period === "1"
      ? data.seo.periods[7]?.pages ?? []
      : data.seo.periods[Number(period) as 7 | 28 | 90]?.pages ?? [];
  const chartLabels = data.seo.dailyStats.map((row) => row.date.slice(5));
  const showMetrics =
    status.kind === "ok" || status.kind === "stale" || status.kind === "refreshing";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OpsPeriodButtons
          options={GSC_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="min-h-11 shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {refreshing ? "更新中…" : "Search Consoleを更新"}
        </button>
      </div>

      <OpsDataStatusBanner status={status} />

      {status.kind === "unconfigured" ? (
        <OpsEmptyState message="Search Console APIが未設定です。" />
      ) : null}

      {showMetrics ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <OpsKpiCard label="クリック数" value={formatSeoNumber(current.clicks)}>
              <ChangeBadge label="前期間比" current={current.clicks} previous={previous.clicks} />
              <ChangeBadge
                label="前日比"
                current={dayMetrics.current.clicks}
                previous={dayMetrics.previous.clicks}
              />
              <ChangeBadge
                label="前週比"
                current={weekMetrics?.current.clicks ?? 0}
                previous={weekMetrics?.previous.clicks ?? 0}
              />
              <ChangeBadge
                label="前月比"
                current={monthMetrics?.current.clicks ?? 0}
                previous={monthMetrics?.previous.clicks ?? 0}
              />
            </OpsKpiCard>
            <OpsKpiCard label="表示回数" value={formatSeoNumber(current.impressions)}>
              <ChangeBadge
                label="前期間比"
                current={current.impressions}
                previous={previous.impressions}
              />
            </OpsKpiCard>
            <OpsKpiCard label="平均CTR" value={formatSeoPercent(current.ctr)}>
              <ChangeBadge label="前期間比" current={current.ctr} previous={previous.ctr} />
            </OpsKpiCard>
            <OpsKpiCard label="平均掲載順位" value={formatSeoPosition(current.position)}>
              <p className="text-xs text-muted">
                期間差:{" "}
                {current.position > 0 && previous.position > 0
                  ? (previous.position - current.position).toFixed(1)
                  : "—"}
              </p>
            </OpsKpiCard>
          </div>

          {data.seo.dailyStats.length === 0 ? (
            <OpsEmptyState message="日別推移データはまだありません" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <OpsLineChart
                labels={chartLabels}
                series={[
                  {
                    label: "クリック数推移",
                    data: data.seo.dailyStats.map((row) => row.clicks),
                    color: "#2563eb",
                  },
                ]}
              />
              <OpsLineChart
                labels={chartLabels}
                series={[
                  {
                    label: "表示回数推移",
                    data: data.seo.dailyStats.map((row) => row.impressions),
                    color: "#0891b2",
                  },
                ]}
              />
              <OpsLineChart
                labels={chartLabels}
                series={[
                  {
                    label: "平均順位推移",
                    data: data.seo.dailyStats.map((row) => row.position),
                    color: "#c2410c",
                  },
                ]}
              />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <OpsSectionCard title="人気検索クエリ">
              {queries.length === 0 ? (
                <OpsEmptyState message="人気検索クエリはまだありません" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface/50 text-muted">
                      <tr>
                        <th className="px-3 py-2">検索キーワード</th>
                        <th className="px-3 py-2">クリック数</th>
                        <th className="px-3 py-2">表示回数</th>
                        <th className="px-3 py-2">CTR</th>
                        <th className="px-3 py-2">順位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queries.slice(0, 20).map((row) => (
                        <tr key={row.keyword} className="border-t border-border">
                          <td className="max-w-[200px] truncate px-3 py-2" title={row.keyword}>
                            {row.keyword}
                          </td>
                          <td className="px-3 py-2">{formatSeoNumber(row.clicks)}</td>
                          <td className="px-3 py-2">{formatSeoNumber(row.impressions)}</td>
                          <td className="px-3 py-2">{formatSeoPercent(row.ctr)}</td>
                          <td className="px-3 py-2">{formatSeoPosition(row.position)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </OpsSectionCard>

            <OpsSectionCard title="人気ページ">
              {pages.length === 0 ? (
                <OpsEmptyState message="人気ページデータはまだありません" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface/50 text-muted">
                      <tr>
                        <th className="px-3 py-2">URL</th>
                        <th className="px-3 py-2">クリック数</th>
                        <th className="px-3 py-2">表示回数</th>
                        <th className="px-3 py-2">CTR</th>
                        <th className="px-3 py-2">順位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.slice(0, 20).map((row) => (
                        <tr key={row.url} className="border-t border-border">
                          <td className="max-w-[220px] truncate px-3 py-2" title={row.url}>
                            {row.url}
                          </td>
                          <td className="px-3 py-2">{formatSeoNumber(row.clicks)}</td>
                          <td className="px-3 py-2">{formatSeoNumber(row.impressions)}</td>
                          <td className="px-3 py-2">{formatSeoPercent(row.ctr)}</td>
                          <td className="px-3 py-2">{formatSeoPosition(row.position)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </OpsSectionCard>
          </div>

          <OpsSectionCard title="インデックス">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
              <OpsKpiCard
                label="Google登録ページ数"
                value={
                  data.seo.index.indexedPages == null
                    ? "—"
                    : formatSeoNumber(data.seo.index.indexedPages)
                }
              />
              <OpsKpiCard
                label="インデックス対象URL数"
                value={
                  data.top.indexableUrlCount == null
                    ? "—"
                    : formatSeoNumber(data.top.indexableUrlCount)
                }
              />
              <OpsKpiCard
                label="インデックス率"
                value={
                  data.top.indexRate == null
                    ? "—"
                    : formatSeoPercent(data.top.indexRate)
                }
              />
              <OpsKpiCard
                label="未登録理由"
                value={
                  data.seo.crawlErrors.length > 0
                    ? data.seo.crawlErrors
                        .slice(0, 2)
                        .map((row) => `${row.label}(${row.count})`)
                        .join(" / ")
                    : data.seo.index.indexedSource === "sitemap"
                      ? "サイトマップ推定（詳細理由は未取得）"
                      : "未取得"
                }
              />
              <OpsKpiCard
                label="クロール済み未登録"
                value={formatSeoNumber(data.seo.index.excludedPages ?? 0)}
              />
              <OpsKpiCard
                label="検出済み未登録"
                value={
                  data.seo.index.notIndexedPages == null
                    ? "—"
                    : formatSeoNumber(
                        Math.max(
                          0,
                          (data.seo.index.notIndexedPages ?? 0) -
                            (data.seo.index.excludedPages ?? 0),
                        ),
                      )
                }
              />
            </div>
          </OpsSectionCard>

          <OpsSectionCard title="サイトマップ">
            {data.seo.sitemaps.length === 0 ? (
              <OpsEmptyState
                message={
                  data.sitemapSummary.message ||
                  "サイトマップ一覧はまだありません"
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface/50 text-muted">
                    <tr>
                      <th className="px-3 py-2">サイトマップURL</th>
                      <th className="px-3 py-2">送信日時</th>
                      <th className="px-3 py-2">最終取得日時</th>
                      <th className="px-3 py-2">状態</th>
                      <th className="px-3 py-2">警告数</th>
                      <th className="px-3 py-2">エラー数</th>
                      <th className="px-3 py-2">検出URL数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.seo.sitemaps.map((row) => (
                      <tr key={row.path} className="border-t border-border">
                        <td className="max-w-[240px] truncate px-3 py-2" title={row.path}>
                          {row.path}
                        </td>
                        <td className="px-3 py-2">
                          {formatSeoDateTime(row.lastSubmitted ?? null)}
                        </td>
                        <td className="px-3 py-2">
                          {formatSeoDateTime(row.lastDownloaded ?? null)}
                        </td>
                        <td className="px-3 py-2">
                          {row.errors > 0
                            ? "エラーあり"
                            : row.isPending
                              ? "処理中"
                              : row.warnings > 0
                                ? "警告あり"
                                : "正常"}
                        </td>
                        <td className="px-3 py-2">{formatSeoNumber(row.warnings)}</td>
                        <td className="px-3 py-2">{formatSeoNumber(row.errors)}</td>
                        <td className="px-3 py-2">
                          {formatSeoNumber(row.contentsCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsSectionCard>
        </>
      ) : status.kind === "error" || status.kind === "not_fetched" ? (
        <OpsEmptyState
          message={
            status.kind === "not_fetched"
              ? "Search Consoleデータをまだ取得していません。"
              : status.detail ?? "Search Consoleの取得に失敗しました。"
          }
        />
      ) : null}
    </div>
  );
}
