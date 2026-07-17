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
import { TruncatedUrlButton } from "@/components/admin/ops/TruncatedUrlButton";
import {
  deriveSeoDataStatus,
  metricsFromDaily,
  resolveGscMetrics,
} from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsDashboardPayload, OpsGscPeriod } from "@/lib/admin/ops-types";

function formatNullableCount(value: number | null | undefined): string {
  if (value == null) return "取得不可";
  return formatSeoNumber(value);
}

function IndexMetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: string | null;
}) {
  const changeTone =
    change == null
      ? null
      : change.startsWith("+")
        ? "text-green-600"
        : change.startsWith("-")
          ? "text-red-600"
          : "text-muted";

  return (
    <div className="flex h-full min-h-[104px] min-w-0 flex-col justify-between rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <p className="truncate text-xs font-medium text-muted sm:text-sm">{label}</p>
      <div className="mt-2 min-w-0">
        <p className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
          {value}
        </p>
        {change ? (
          <p className={`mt-1 truncate text-xs font-medium tabular-nums ${changeTone}`}>
            {change}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatIndexedPagesDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): string | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return "±0";
  const formatted = formatSeoNumber(Math.abs(delta));
  return delta > 0 ? `+${formatted}` : `-${formatted}`;
}

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

  const searchVisiblePages28 = useMemo(() => {
    const pages28 = data.seo.periods[28]?.pages ?? [];
    return pages28.filter((page) => page.impressions > 0).length;
  }, [data.seo.periods]);

  const unregisteredReasonRows = useMemo(() => {
    const crawlByType = new Map(
      data.seo.crawlErrors.map((row) => [row.type, row] as const),
    );
    const notIndexed = data.seo.index.notIndexedPages;
    const excluded = data.seo.index.excludedPages;
    const detectedUnregistered =
      notIndexed == null
        ? null
        : Math.max(0, notIndexed - (excluded ?? 0));

    return [
      {
        label: "404",
        value: formatSeoNumber(crawlByType.get("404")?.count ?? 0),
      },
      {
        label: "Redirect",
        value: formatSeoNumber(crawlByType.get("redirect")?.count ?? 0),
      },
      {
        label: "クロール済未登録",
        value: formatSeoNumber(excluded ?? 0),
      },
      {
        label: "検出済未登録",
        value: formatNullableCount(detectedUnregistered),
      },
    ];
  }, [data.seo.crawlErrors, data.seo.index.excludedPages, data.seo.index.notIndexedPages]);

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
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <IndexMetricCard
                label="Google登録ページ数"
                value={
                  data.seo.index.indexedPages == null
                    ? "取得不可"
                    : formatSeoNumber(data.seo.index.indexedPages)
                }
                change={formatIndexedPagesDelta(
                  data.seo.index.indexedPages,
                  data.seo.index.previousIndexedPages,
                )}
              />
              <IndexMetricCard
                label="インデックス対象URL数"
                value={
                  data.top.indexableUrlCount == null
                    ? "取得不可"
                    : formatSeoNumber(data.top.indexableUrlCount)
                }
              />
              <IndexMetricCard
                label="インデックス率"
                value={
                  data.top.indexRate == null
                    ? "取得不可"
                    : formatSeoPercent(data.top.indexRate)
                }
              />
              <IndexMetricCard
                label="Google検索表示ページ数（28日）"
                value={formatSeoNumber(searchVisiblePages28)}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="flex h-full min-h-[140px] min-w-0 flex-col rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
                <p className="truncate text-xs font-medium text-muted sm:text-sm">
                  未登録理由
                </p>
                <ul className="mt-3 space-y-2">
                  {unregisteredReasonRows.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-3 whitespace-nowrap text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        {row.label}
                      </span>
                      <span
                        className={`shrink-0 font-bold tabular-nums ${
                          row.value === "取得不可"
                            ? "text-muted"
                            : "text-foreground"
                        }`}
                      >
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
              <>
                {/* スマホ: カード */}
                <ul className="space-y-3 md:hidden">
                  {data.seo.sitemaps.map((row) => (
                    <li
                      key={row.path}
                      className="rounded-xl border border-border bg-surface/30 p-3"
                    >
                      <TruncatedUrlButton url={row.path} />
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-muted">送信日時</dt>
                          <dd className="truncate font-medium text-foreground">
                            {formatSeoDateTime(row.lastSubmitted ?? null)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">最終取得</dt>
                          <dd className="truncate font-medium text-foreground">
                            {formatSeoDateTime(row.lastDownloaded ?? null)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">状態</dt>
                          <dd className="truncate font-medium text-foreground">
                            {row.errors > 0
                              ? "エラーあり"
                              : row.isPending
                                ? "処理中"
                                : row.warnings > 0
                                  ? "警告あり"
                                  : "正常"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">検出URL数</dt>
                          <dd className="truncate font-medium text-foreground">
                            {formatSeoNumber(row.contentsCount)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">警告</dt>
                          <dd className="font-medium text-foreground">
                            {formatSeoNumber(row.warnings)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">エラー</dt>
                          <dd className="font-medium text-foreground">
                            {formatSeoNumber(row.errors)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>

                {/* PC: テーブル */}
                <div className="hidden overflow-x-auto md:block">
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
                        <tr key={row.path} className="border-t border-border align-top">
                          <td className="max-w-[280px] px-3 py-2">
                            <TruncatedUrlButton url={row.path} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatSeoDateTime(row.lastSubmitted ?? null)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatSeoDateTime(row.lastDownloaded ?? null)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {row.errors > 0
                              ? "エラーあり"
                              : row.isPending
                                ? "処理中"
                                : row.warnings > 0
                                  ? "警告あり"
                                  : "正常"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatSeoNumber(row.warnings)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatSeoNumber(row.errors)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatSeoNumber(row.contentsCount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
