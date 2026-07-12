"use client";

import { useMemo, useState, useTransition } from "react";
import { OpsDoughnutChart, OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  ChangeBadge,
  OpsKpiCard,
  formatDuration,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type {
  OpsDashboardPayload,
  OpsDmmPeriod,
  OpsGscPeriod,
  OpsGa4Period,
  OpsTask,
  OpsTaskBucket,
} from "@/lib/admin/ops-types";
import type { SeoPeriodMetrics } from "@/lib/admin/seo-types";

type OpsDashboardClientProps = {
  initialData: OpsDashboardPayload;
};

const GSC_PERIODS: Array<{ id: OpsGscPeriod; label: string }> = [
  { id: "1", label: "24時間" },
  { id: "7", label: "7日" },
  { id: "28", label: "28日" },
  { id: "90", label: "90日" },
];

const GA4_PERIODS: Array<{ id: OpsGa4Period; label: string }> = [
  { id: 1, label: "24時間" },
  { id: 7, label: "7日" },
  { id: 28, label: "28日" },
  { id: 90, label: "90日" },
];

const DMM_PERIODS: Array<{ id: OpsDmmPeriod; label: string }> = [
  { id: "today", label: "今日" },
  { id: "yesterday", label: "昨日" },
  { id: "7d", label: "7日" },
  { id: "28d", label: "28日" },
  { id: "90d", label: "90日" },
];

const TASK_BUCKET_LABEL: Record<OpsTaskBucket, string> = {
  urgent: "最優先",
  this_week: "今週対応",
  backlog: "余裕があれば",
};

function alertClass(severity: OpsDashboardPayload["alerts"][number]["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
    case "success":
      return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100";
    default:
      return "border-border bg-white text-foreground dark:border-zinc-700 dark:bg-zinc-900";
  }
}

function emptyMetrics(): SeoPeriodMetrics {
  return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

function metricsFromDaily(
  daily: OpsDashboardPayload["seo"]["dailyStats"],
  days: number,
  offsetDays = 0,
): SeoPeriodMetrics {
  const slice = daily.slice(-(days + offsetDays), offsetDays === 0 ? undefined : -offsetDays);
  if (slice.length === 0) return emptyMetrics();
  const clicks = slice.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = slice.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = slice.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

function mapTrafficSources(ga4: OpsDashboardPayload["ga4"]) {
  const groups: Record<string, number> = {
    Google検索: 0,
    X: 0,
    直接: 0,
    参照: 0,
    その他: 0,
  };

  for (const row of ga4.sources) {
    const name = row.source.toLowerCase();
    if (name.includes("organic") || name.includes("google")) {
      groups["Google検索"] += row.sessions;
    } else if (name.includes("social") || name.includes("twitter") || name.includes("x")) {
      groups.X += row.sessions;
    } else if (name.includes("direct")) {
      groups["直接"] += row.sessions;
    } else if (name.includes("referral")) {
      groups["参照"] += row.sessions;
    } else {
      groups["その他"] += row.sessions;
    }
  }

  return groups;
}

function PeriodButtons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === option.id
              ? "bg-accent text-white"
              : "bg-surface text-foreground hover:bg-border"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function OpsDashboardClient({ initialData }: OpsDashboardClientProps) {
  const [data, setData] = useState(initialData);
  const [gscPeriod, setGscPeriod] = useState<OpsGscPeriod>("28");
  const [ga4Period, setGa4Period] = useState<OpsGa4Period>(28);
  const [dmmPeriod, setDmmPeriod] = useState<OpsDmmPeriod>("7d");
  const [tasks, setTasks] = useState<OpsTask[]>(initialData.tasks);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedScoreKey, setExpandedScoreKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const gscCurrent = useMemo(() => {
    if (gscPeriod === "1") {
      return metricsFromDaily(data.seo.dailyStats, 1);
    }
    return data.seo.periods[Number(gscPeriod) as 7 | 28 | 90]?.current ?? emptyMetrics();
  }, [data.seo, gscPeriod]);

  const gscPrevious = useMemo(() => {
    if (gscPeriod === "1") {
      return metricsFromDaily(data.seo.dailyStats, 1, 1);
    }
    return data.seo.periods[Number(gscPeriod) as 7 | 28 | 90]?.previous ?? emptyMetrics();
  }, [data.seo, gscPeriod]);

  const dayMetrics = useMemo(
    () => ({
      current: metricsFromDaily(data.seo.dailyStats, 1),
      previous: metricsFromDaily(data.seo.dailyStats, 1, 1),
    }),
    [data.seo.dailyStats],
  );
  const weekMetrics = data.seo.periods[7];
  const monthMetrics = data.seo.periods[28];

  const gscQueries =
    gscPeriod === "1"
      ? data.seo.periods[7]?.queries ?? []
      : data.seo.periods[Number(gscPeriod) as 7 | 28 | 90]?.queries ?? [];
  const gscPages =
    gscPeriod === "1"
      ? data.seo.periods[7]?.pages ?? []
      : data.seo.periods[Number(gscPeriod) as 7 | 28 | 90]?.pages ?? [];

  const ga4Bundle = data.ga4.periods[ga4Period];
  const dmmMetrics = data.dmm.periods[dmmPeriod];
  const traffic = mapTrafficSources(data.ga4);

  const chartLabels = data.seo.dailyStats.map((row) => row.date.slice(5));
  const ga4Labels = data.ga4.daily.map((row) => row.date.slice(5));
  const dmmLabels = data.dmm.daily.map((row) => row.date.slice(5));

  function completeTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: true } : task,
      ),
    );
  }

  function refresh() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/admin/ops/refresh", { method: "POST" });
        const json = (await response.json()) as {
          success?: boolean;
          data?: OpsDashboardPayload;
          error?: string;
        };
        if (!response.ok || !json.data) {
          setMessage(json.error ?? "更新に失敗しました。");
          return;
        }
        setData(json.data);
        setTasks(json.data.tasks);
        setMessage("データを更新しました。");
      } catch {
        setMessage("更新リクエストに失敗しました。");
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            運営ダッシュボード
          </h1>
          <p className="mt-2 text-sm text-muted">
            Search Console / GA4 / DMM成果を一画面で確認
          </p>
          <p className="mt-1 text-xs text-muted">
            最終更新: {formatSeoDateTime(data.top.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "更新中…" : "手動更新"}
        </button>
      </section>

      {message ? (
        <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-foreground">今日のSEO改善提案</h2>
        <ul className="mt-4 space-y-3">
          {data.suggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              className="rounded-lg border border-border bg-surface/40 px-4 py-3"
            >
              <p className="text-sm font-semibold text-amber-600">{suggestion.stars}</p>
              <p className="mt-1 text-sm text-foreground">{suggestion.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {data.alerts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">アラート</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${alertClass(alert.severity)}`}
              >
                <p className="font-bold">{alert.title}</p>
                <p className="mt-1 text-sm">{alert.detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">SEO SCORE</p>
            <p className="mt-1 text-5xl font-bold text-foreground">
              {data.seoScore.total == null ? "—" : data.seoScore.total}
              <span className="ml-2 text-base font-medium text-muted">/ 100</span>
            </p>
            {data.seoScore.partial ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                一部データ未取得（取得済み {data.seoScore.earned.toFixed(1)} / {data.seoScore.availableMax} を100点換算）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted">
              最終計算: {formatSeoDateTime(data.seoScore.calculatedAt)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.seoScore.categories.map((category) => {
            const open = expandedScoreKey === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() =>
                  setExpandedScoreKey(open ? null : category.key)
                }
                className="rounded-lg border border-border px-4 py-3 text-left hover:bg-surface/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-foreground">{category.label}</p>
                  <p className="text-sm font-bold text-foreground">
                    {category.available
                      ? `${category.points} / ${category.maxPoints}`
                      : "未取得"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">{category.evidence}</p>
                {open ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-foreground">
                    <p>状態: {category.statusLabel}</p>
                    <p>計算日時: {formatSeoDateTime(category.calculatedAt)}</p>
                    <p>改善: {category.improvement}</p>
                    {category.details.map((detail) => (
                      <p key={detail.label}>
                        ・{detail.label}:{" "}
                        {detail.available
                          ? `${detail.points}/${detail.maxPoints}`
                          : "未取得"}{" "}
                       （{detail.evidence}）
                      </p>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground">ダッシュボードTOP</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <OpsKpiCard
            label="今日の売上"
            value={
              data.analyticsKpis.salesToday == null
                ? "—"
                : formatYen(data.analyticsKpis.salesToday)
            }
          />
          <OpsKpiCard
            label="昨日の売上"
            value={
              data.analyticsKpis.salesYesterday == null
                ? "—"
                : formatYen(data.analyticsKpis.salesYesterday)
            }
          />
          <OpsKpiCard
            label="28日売上"
            value={
              data.analyticsKpis.sales28d == null
                ? "—"
                : formatYen(data.analyticsKpis.sales28d)
            }
          />
          <OpsKpiCard
            label="Google流入数"
            value={
              data.analyticsKpis.googleSessions28d == null
                ? "—"
                : formatSeoNumber(data.analyticsKpis.googleSessions28d)
            }
          />
          <OpsKpiCard
            label="検索クリック数"
            value={
              data.analyticsKpis.searchClicks28d == null
                ? "—"
                : formatSeoNumber(data.analyticsKpis.searchClicks28d)
            }
          />
          <OpsKpiCard
            label="平均順位"
            value={
              data.analyticsKpis.avgPosition28d == null
                ? "—"
                : formatSeoPosition(data.analyticsKpis.avgPosition28d)
            }
          />
          <OpsKpiCard
            label="CTR"
            value={
              data.analyticsKpis.ctr28d == null
                ? "—"
                : formatSeoPercent(data.analyticsKpis.ctr28d)
            }
          />
          <OpsKpiCard
            label="成果率 / CVR"
            value={
              data.analyticsKpis.cvr28d == null
                ? "—"
                : formatSeoPercent(data.analyticsKpis.cvr28d)
            }
          />
          <OpsKpiCard
            label="RPM"
            value={
              data.analyticsKpis.rpm28d == null
                ? "—"
                : formatYen(data.analyticsKpis.rpm28d)
            }
          />
          <OpsKpiCard
            label="前回正常取得"
            value={formatSeoDateTime(
              data.analyticsKpis.lastSuccessfulAt.ga4 ??
                data.analyticsKpis.lastSuccessfulAt.dmm ??
                data.analyticsKpis.lastSuccessfulAt.seo,
            )}
          >
            <p className="text-xs text-muted">
              GA4: {formatSeoDateTime(data.analyticsKpis.lastSuccessfulAt.ga4)} /
              DMM: {formatSeoDateTime(data.analyticsKpis.lastSuccessfulAt.dmm)}
            </p>
          </OpsKpiCard>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["作品数", data.top.catalog.works],
              ["女優数", data.top.catalog.actresses],
              ["メーカー数", data.top.catalog.makers],
              ["レーベル数", data.top.catalog.labels],
              ["シリーズ数", data.top.catalog.series],
              ["ジャンル数", data.top.catalog.genres],
            ] as const
          ).map(([label, value]) => (
            <OpsKpiCard
              key={label}
              label={label}
              value={formatSeoNumber(value)}
            />
          ))}
          <OpsKpiCard
            label="Google登録ページ数"
            value={
              data.top.indexedPages == null
                ? "—"
                : formatSeoNumber(data.top.indexedPages)
            }
          >
            {data.top.indexEstimated ? (
              <p className="text-xs text-muted">推定値</p>
            ) : null}
          </OpsKpiCard>
          <OpsKpiCard
            label="Google未登録ページ数"
            value={
              data.top.notIndexedPages == null
                ? "推定不可"
                : formatSeoNumber(data.top.notIndexedPages)
            }
          />
          <OpsKpiCard
            label="インデックス対象URL"
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
            label="最終更新日時"
            value={formatSeoDateTime(data.top.updatedAt)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-foreground">Search Console</h2>
          <PeriodButtons
            options={GSC_PERIODS}
            value={gscPeriod}
            onChange={setGscPeriod}
          />
        </div>
        {!data.seo.configured ? (
          <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted">
            {data.seo.configMessage ?? "Search Console APIが未設定です。"}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OpsKpiCard label="クリック数" value={formatSeoNumber(gscCurrent.clicks)}>
            <ChangeBadge
              label="期間比"
              current={gscCurrent.clicks}
              previous={gscPrevious.clicks}
            />
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
          <OpsKpiCard
            label="表示回数"
            value={formatSeoNumber(gscCurrent.impressions)}
          >
            <ChangeBadge
              label="期間比"
              current={gscCurrent.impressions}
              previous={gscPrevious.impressions}
            />
          </OpsKpiCard>
          <OpsKpiCard label="平均CTR" value={formatSeoPercent(gscCurrent.ctr)}>
            <ChangeBadge
              label="期間比"
              current={gscCurrent.ctr}
              previous={gscPrevious.ctr}
            />
          </OpsKpiCard>
          <OpsKpiCard
            label="平均掲載順位"
            value={formatSeoPosition(gscCurrent.position)}
          >
            <p className="text-xs text-muted">
              期間差:{" "}
              {gscCurrent.position > 0 && gscPrevious.position > 0
                ? `${(gscPrevious.position - gscCurrent.position).toFixed(1)}`
                : "—"}
            </p>
          </OpsKpiCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <OpsLineChart
            labels={chartLabels}
            series={[
              {
                label: "クリック推移",
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

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-border px-4 py-3 font-semibold">
              人気検索クエリ
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface/50 text-muted">
                <tr>
                  <th className="px-3 py-2">検索キーワード</th>
                  <th className="px-3 py-2">クリック</th>
                  <th className="px-3 py-2">表示</th>
                  <th className="px-3 py-2">CTR</th>
                  <th className="px-3 py-2">順位</th>
                </tr>
              </thead>
              <tbody>
                {gscQueries.slice(0, 15).map((row) => (
                  <tr key={row.keyword} className="border-t border-border">
                    <td className="px-3 py-2">{row.keyword}</td>
                    <td className="px-3 py-2">{formatSeoNumber(row.clicks)}</td>
                    <td className="px-3 py-2">
                      {formatSeoNumber(row.impressions)}
                    </td>
                    <td className="px-3 py-2">{formatSeoPercent(row.ctr)}</td>
                    <td className="px-3 py-2">
                      {formatSeoPosition(row.position)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-border px-4 py-3 font-semibold">
              人気ページ
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface/50 text-muted">
                <tr>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">クリック</th>
                  <th className="px-3 py-2">表示</th>
                  <th className="px-3 py-2">CTR</th>
                  <th className="px-3 py-2">順位</th>
                </tr>
              </thead>
              <tbody>
                {gscPages.slice(0, 15).map((row) => (
                  <tr key={row.url} className="border-t border-border">
                    <td className="max-w-[220px] truncate px-3 py-2" title={row.url}>
                      {row.url}
                    </td>
                    <td className="px-3 py-2">{formatSeoNumber(row.clicks)}</td>
                    <td className="px-3 py-2">
                      {formatSeoNumber(row.impressions)}
                    </td>
                    <td className="px-3 py-2">{formatSeoPercent(row.ctr)}</td>
                    <td className="px-3 py-2">
                      {formatSeoPosition(row.position)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <OpsKpiCard
            label="登録ページ数"
            value={
              data.seo.index.indexedPages == null
                ? "—"
                : formatSeoNumber(data.seo.index.indexedPages)
            }
          />
          <OpsKpiCard
            label="未登録ページ数"
            value={
              data.seo.index.notIndexedPages == null
                ? "—"
                : formatSeoNumber(data.seo.index.notIndexedPages)
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
          <OpsKpiCard
            label="送信済みサイトマップ"
            value={
              data.sitemapSummary.state === "success_with_data"
                ? `${data.sitemapSummary.gscSubmittedCount}件`
                : data.sitemapSummary.state === "success_empty"
                  ? "0件"
                  : data.sitemapSummary.state === "error"
                    ? "取得失敗"
                    : data.sitemapSummary.state === "unavailable"
                      ? "未設定"
                      : "取得中"
            }
          >
            <p className="text-xs text-muted">{data.sitemapSummary.message}</p>
            <p className="text-xs text-muted">
              サイト側生成：{data.sitemapSummary.siteGeneratedCount}件 /
              正常 {data.sitemapSummary.healthyCount} /
              警告 {data.sitemapSummary.warningCount} /
              エラー {data.sitemapSummary.errorCount}
            </p>
          </OpsKpiCard>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-border px-4 py-3 font-semibold">
            Search Console サイトマップ一覧（sitemaps.list）
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface/50 text-muted">
              <tr>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">種別</th>
                <th className="px-3 py-2">送信日時</th>
                <th className="px-3 py-2">最終DL</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">警告</th>
                <th className="px-3 py-2">エラー</th>
                <th className="px-3 py-2">検出URL</th>
                <th className="px-3 py-2">検出動画</th>
              </tr>
            </thead>
            <tbody>
              {data.seo.sitemaps.map((row) => (
                <tr key={row.path} className="border-t border-border">
                  <td className="max-w-[240px] truncate px-3 py-2" title={row.path}>
                    {row.path}
                  </td>
                  <td className="px-3 py-2">{row.typeLabel ?? "—"}</td>
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
                  <td className="px-3 py-2">
                    {formatSeoNumber(row.videoSubmitted ?? 0)}
                  </td>
                </tr>
              ))}
              {data.seo.sitemaps.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={9}>
                    {data.sitemapSummary.message}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-foreground">Google Analytics 4</h2>
          <PeriodButtons
            options={GA4_PERIODS}
            value={ga4Period}
            onChange={setGa4Period}
          />
        </div>
        {!data.ga4.configured ? (
          <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted">
            {data.ga4.configMessage}
          </p>
        ) : null}
        {data.ga4.connectionStatus === "stale" || data.ga4.fetchError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {data.ga4.fetchError
              ? `GA4取得エラー（前回取得日時: ${formatSeoDateTime(data.ga4.lastSuccessfulAt)}）: ${data.ga4.fetchError}`
              : `前回取得日時: ${formatSeoDateTime(data.ga4.lastSuccessfulAt)}`}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OpsKpiCard
            label="ユーザー数"
            value={formatSeoNumber(ga4Bundle.current.users)}
          >
            <ChangeBadge
              label="前期間比"
              current={ga4Bundle.current.users}
              previous={ga4Bundle.previous.users}
            />
          </OpsKpiCard>
          <OpsKpiCard
            label="新規ユーザー数"
            value={formatSeoNumber(ga4Bundle.current.newUsers)}
          />
          <OpsKpiCard
            label="セッション数"
            value={formatSeoNumber(ga4Bundle.current.sessions)}
          />
          <OpsKpiCard
            label="ページビュー"
            value={formatSeoNumber(ga4Bundle.current.pageViews)}
          />
          <OpsKpiCard
            label="平均エンゲージメント時間"
            value={formatDuration(ga4Bundle.current.avgEngagementSeconds)}
          />
          <OpsKpiCard
            label="イベント数"
            value={formatSeoNumber(ga4Bundle.current.eventCount)}
          />
          <OpsKpiCard
            label="直帰率"
            value={formatSeoPercent(ga4Bundle.current.bounceRate)}
          />
          <OpsKpiCard
            label="ページ/セッション"
            value={ga4Bundle.current.pagesPerSession.toFixed(2)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <OpsLineChart
            labels={ga4Labels}
            series={[
              {
                label: "ユーザー推移",
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
                label: "新規ユーザー推移",
                data: data.ga4.daily.map((row) => row.newUsers),
                color: "#16a34a",
              },
            ]}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-border px-4 py-3 font-semibold">
              人気ページ
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface/50 text-muted">
                <tr>
                  <th className="px-3 py-2">パス</th>
                  <th className="px-3 py-2">PV</th>
                  <th className="px-3 py-2">ユーザー</th>
                  <th className="px-3 py-2">平均滞在</th>
                </tr>
              </thead>
              <tbody>
                {data.ga4.topPages.map((row) => (
                  <tr key={row.path} className="border-t border-border">
                    <td className="max-w-[220px] truncate px-3 py-2">{row.path}</td>
                    <td className="px-3 py-2">
                      {formatSeoNumber(row.pageViews)}
                    </td>
                    <td className="px-3 py-2">{formatSeoNumber(row.users)}</td>
                    <td className="px-3 py-2">
                      {formatDuration(row.avgEngagementSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-3 font-semibold">流入元</p>
            <OpsDoughnutChart
              labels={Object.keys(traffic)}
              values={Object.values(traffic)}
              colors={["#2563eb", "#111827", "#64748b", "#0d9488", "#a3a3a3"]}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">DMMアフィリエイト</h2>
            <p className="mt-1 text-xs text-muted">
              取込管理:{" "}
              <a href="/admin/dmm" className="text-accent underline">
                /admin/dmm
              </a>
            </p>
          </div>
          <PeriodButtons
            options={DMM_PERIODS}
            value={dmmPeriod}
            onChange={setDmmPeriod}
          />
        </div>
        {!data.dmm.configured ? (
          <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted">
            {data.dmm.configMessage}
          </p>
        ) : null}
        {data.dmm.connectionStatus === "stale" || data.dmm.fetchError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {data.dmm.fetchError
              ? `DMM取得エラー（前回取得日時: ${formatSeoDateTime(data.dmm.lastSuccessfulAt)}）: ${data.dmm.fetchError}`
              : `前回取得日時: ${formatSeoDateTime(data.dmm.lastSuccessfulAt)}`}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <OpsKpiCard label="クリック数" value={formatSeoNumber(dmmMetrics.clicks)} />
          <OpsKpiCard
            label="成果件数"
            value={formatSeoNumber(dmmMetrics.conversions)}
          />
          <OpsKpiCard
            label="成果率"
            value={formatSeoPercent(dmmMetrics.conversionRate)}
          />
          <OpsKpiCard label="報酬" value={formatYen(dmmMetrics.reward)} />
          <OpsKpiCard
            label="クリック単価"
            value={formatYen(dmmMetrics.clickUnitPrice)}
          />
          <OpsKpiCard
            label="成果単価"
            value={formatYen(dmmMetrics.conversionUnitPrice)}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <OpsLineChart
            labels={dmmLabels}
            series={[
              {
                label: "クリック推移",
                data: data.dmm.daily.map((row) => row.clicks),
                color: "#2563eb",
              },
            ]}
          />
          <OpsLineChart
            labels={dmmLabels}
            series={[
              {
                label: "成果推移",
                data: data.dmm.daily.map((row) => row.conversions),
                color: "#16a34a",
              },
            ]}
          />
          <OpsLineChart
            labels={dmmLabels}
            series={[
              {
                label: "報酬推移",
                data: data.dmm.daily.map((row) => row.reward),
                color: "#c2410c",
              },
            ]}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">作品別ランキング（報酬）</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(data.dmm.rankings?.works ?? []).map((row) => (
                <li key={row.key}>
                  {row.name} — ¥{Math.round(row.reward).toLocaleString("ja-JP")} /
                  成果 {row.sales}
                </li>
              ))}
              {(data.dmm.rankings?.works ?? []).length === 0 ? (
                <li className="text-muted">
                  entities 付きレポート取込で自動生成されます
                </li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">女優別ランキング（報酬）</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(data.dmm.rankings?.actresses ?? []).map((row) => (
                <li key={row.key}>
                  {row.name} — ¥{Math.round(row.reward).toLocaleString("ja-JP")} /
                  成果 {row.sales}
                </li>
              ))}
              {(data.dmm.rankings?.actresses ?? []).length === 0 ? (
                <li className="text-muted">
                  entities 付きレポート取込で自動生成されます
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        {data.dmm.insights &&
        (data.dmm.insights.highConversionWorks.length > 0 ||
          data.dmm.insights.topRewardGenres.length > 0) ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="font-semibold">成果率が高い作品</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {data.dmm.insights.highConversionWorks.map((row) => (
                  <li key={row.key}>
                    {row.name}（{(row.conversion_rate * 100).toFixed(1)}%）
                  </li>
                ))}
                {data.dmm.insights.highConversionWorks.length === 0 ? (
                  <li className="text-muted">データなし（entities取込が必要）</li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="font-semibold">報酬の多いジャンル</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {data.dmm.insights.topRewardGenres.map((row) => (
                  <li key={row.key}>
                    {row.name}（¥{Math.round(row.reward).toLocaleString("ja-JP")}）
                  </li>
                ))}
                {data.dmm.insights.topRewardGenres.length === 0 ? (
                  <li className="text-muted">データなし（entities取込が必要）</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">AIタスク</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["urgent", "this_week", "backlog"] as OpsTaskBucket[]).map(
            (bucket) => (
              <div
                key={bucket}
                className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <h3 className="font-semibold text-foreground">
                  {TASK_BUCKET_LABEL[bucket]}
                </h3>
                <ul className="mt-3 space-y-3">
                  {tasks
                    .filter((task) => task.bucket === bucket)
                    .map((task) => (
                      <li
                        key={task.id}
                        className="rounded-lg border border-border px-3 py-2"
                      >
                        <p
                          className={`text-sm ${
                            task.completed
                              ? "text-muted line-through"
                              : "text-foreground"
                          }`}
                        >
                          {task.text}
                        </p>
                        {!task.completed ? (
                          <button
                            type="button"
                            onClick={() => completeTask(task.id)}
                            className="mt-2 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
                          >
                            完了
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-green-600">完了済み</p>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </section>

      <p className="text-xs text-muted">
        自動更新: 毎日 5:00 / 17:00（JST）。前期間比の上昇は緑、下降は赤で表示。
      </p>
    </div>
  );
}
