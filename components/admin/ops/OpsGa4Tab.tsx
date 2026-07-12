"use client";

import { OpsDoughnutChart, OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  ChangeBadge,
  OpsKpiCard,
  formatDuration,
  formatSeoNumber,
  formatSeoPercent,
} from "@/components/admin/ops/OpsShared";
import {
  OpsDataStatusBanner,
  OpsEmptyState,
  OpsPeriodButtons,
  OpsSectionCard,
} from "@/components/admin/ops/OpsUi";
import {
  deriveGa4DataStatus,
  mapTrafficSources,
} from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsDashboardPayload, OpsGa4Period } from "@/lib/admin/ops-types";

const GA4_PERIODS: Array<{ id: OpsGa4Period; label: string }> = [
  { id: 1, label: "24時間" },
  { id: 7, label: "7日" },
  { id: 28, label: "28日" },
  { id: 90, label: "90日" },
];

type OpsGa4TabProps = {
  data: OpsDashboardPayload;
  period: OpsGa4Period;
  onPeriodChange: (period: OpsGa4Period) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

export function OpsGa4Tab({
  data,
  period,
  onPeriodChange,
  refreshing,
  onRefresh,
}: OpsGa4TabProps) {
  const status = deriveGa4DataStatus(data.ga4, refreshing, formatSeoDateTime);
  const bundle = data.ga4.periods[period];
  const traffic = mapTrafficSources(data.ga4);
  const trafficTotal = Object.values(traffic).reduce((sum, value) => sum + value, 0);
  const ga4Labels = data.ga4.daily.map((row) => row.date.slice(5));
  const showMetrics =
    status.kind === "ok" || status.kind === "stale" || status.kind === "refreshing";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OpsPeriodButtons
          options={GA4_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="min-h-11 shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {refreshing ? "更新中…" : "GA4を更新"}
        </button>
      </div>

      <OpsDataStatusBanner status={status} />

      {status.kind === "unconfigured" ? (
        <OpsEmptyState message="GA4 APIが未設定です" />
      ) : null}

      {showMetrics && bundle ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <OpsKpiCard label="ユーザー数" value={formatSeoNumber(bundle.current.users)}>
              <ChangeBadge
                label="前期間比"
                current={bundle.current.users}
                previous={bundle.previous.users}
              />
            </OpsKpiCard>
            <OpsKpiCard
              label="新規ユーザー数"
              value={formatSeoNumber(bundle.current.newUsers)}
            />
            <OpsKpiCard
              label="セッション数"
              value={formatSeoNumber(bundle.current.sessions)}
            />
            <OpsKpiCard
              label="ページビュー"
              value={formatSeoNumber(bundle.current.pageViews)}
            />
            <OpsKpiCard
              label="平均エンゲージメント時間"
              value={formatDuration(bundle.current.avgEngagementSeconds)}
            />
            <OpsKpiCard
              label="イベント数"
              value={formatSeoNumber(bundle.current.eventCount)}
            />
            <OpsKpiCard
              label="直帰率"
              value={formatSeoPercent(bundle.current.bounceRate)}
            />
            <OpsKpiCard
              label="ページ/セッション"
              value={bundle.current.pagesPerSession.toFixed(2)}
            />
          </div>

          {data.ga4.daily.length === 0 ? (
            <OpsEmptyState message="日別推移データはまだありません" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <OpsLineChart
                labels={ga4Labels}
                series={[
                  {
                    label: "ユーザー数推移",
                    data: data.ga4.daily.map((row) => row.users),
                    color: "#2563eb",
                  },
                ]}
              />
              <OpsLineChart
                labels={ga4Labels}
                series={[
                  {
                    label: "PV推移",
                    data: data.ga4.daily.map((row) => row.pageViews),
                    color: "#0891b2",
                  },
                ]}
              />
              <OpsLineChart
                labels={ga4Labels}
                series={[
                  {
                    label: "セッション数推移",
                    data: data.ga4.daily.map((row) => row.sessions),
                    color: "#7c3aed",
                  },
                ]}
              />
              <OpsLineChart
                labels={ga4Labels}
                series={[
                  {
                    label: "新規ユーザー推移",
                    data: data.ga4.daily.map((row) => row.newUsers),
                    color: "#16a34a",
                  },
                ]}
              />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <OpsSectionCard title="流入元">
              {trafficTotal === 0 ? (
                <OpsEmptyState message="流入元データはまだありません" />
              ) : (
                <>
                  <OpsDoughnutChart
                    labels={Object.keys(traffic)}
                    values={Object.values(traffic)}
                    colors={["#2563eb", "#111827", "#64748b", "#0d9488", "#a3a3a3"]}
                  />
                  <ul className="mt-4 space-y-1 text-sm text-foreground">
                    {Object.entries(traffic).map(([label, value]) => (
                      <li key={label} className="flex justify-between gap-3">
                        <span>{label}</span>
                        <span className="font-semibold">{formatSeoNumber(value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </OpsSectionCard>

            <OpsSectionCard title="人気ページ">
              {data.ga4.topPages.length === 0 ? (
                <OpsEmptyState message="人気ページデータはまだありません" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface/50 text-muted">
                      <tr>
                        <th className="px-3 py-2">ページタイトル / URL</th>
                        <th className="px-3 py-2">PV</th>
                        <th className="px-3 py-2">ユーザー数</th>
                        <th className="px-3 py-2">平均エンゲージメント時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ga4.topPages.map((row) => (
                        <tr key={row.path} className="border-t border-border">
                          <td className="max-w-[240px] truncate px-3 py-2" title={row.path}>
                            {row.path}
                          </td>
                          <td className="px-3 py-2">{formatSeoNumber(row.pageViews)}</td>
                          <td className="px-3 py-2">{formatSeoNumber(row.users)}</td>
                          <td className="px-3 py-2">
                            {formatDuration(row.avgEngagementSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </OpsSectionCard>
          </div>

          <OpsSectionCard title="ランディングページ">
            <OpsEmptyState message="ランディングページデータはまだありません" />
          </OpsSectionCard>

          <OpsSectionCard title="イベント">
            <OpsEmptyState message="イベント別データはまだありません（合計イベント数は指標カードを参照）" />
          </OpsSectionCard>
        </>
      ) : status.kind === "error" || status.kind === "not_fetched" ? (
        <OpsEmptyState
          message={
            status.kind === "not_fetched"
              ? "GA4データをまだ取得していません。"
              : status.detail ?? "GA4の取得に失敗しました。"
          }
        />
      ) : null}
    </div>
  );
}
