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

      <OpsSectionCard title="GA4認証診断">
        <dl className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
          <DiagItem
            label="使用中のサービスアカウント"
            value={data.ga4.authDiagnostics?.clientEmail ?? "—"}
          />
          <DiagItem
            label="想定サービスアカウント"
            value={
              data.ga4.authDiagnostics?.expectedClientEmail ??
              "adult-zukan-search-console@adult-zukan-seo-502016.iam.gserviceaccount.com"
            }
          />
          <DiagItem
            label="client_email一致"
            value={
              data.ga4.authDiagnostics?.clientEmailMatchesExpected == null
                ? "—"
                : data.ga4.authDiagnostics.clientEmailMatchesExpected
                  ? "一致"
                  : "不一致（403の主因になりやすい）"
            }
          />
          <DiagItem
            label="project_id"
            value={data.ga4.authDiagnostics?.projectId ?? "—"}
          />
          <DiagItem
            label="使用中のプロパティID"
            value={
              data.ga4.authDiagnostics?.property ??
              (data.ga4.propertyId
                ? `properties/${data.ga4.propertyId}`
                : "—")
            }
          />
          <DiagItem
            label="エラーコード"
            value={data.ga4.authDiagnostics?.errorCode ?? (data.ga4.fetchError ? "あり（詳細は下部）" : "なし")}
          />
          <DiagItem
            label="最終取得日時"
            value={formatSeoDateTime(data.ga4.lastSuccessfulAt ?? data.ga4.updatedAt)}
          />
          <DiagItem
            label="実行環境"
            value={data.ga4.authDiagnostics?.runtimeEnvironment ?? "—"}
          />
          <DiagItem
            label="Search Consoleと同一認証"
            value={
              data.ga4.authDiagnostics?.sharedWithSearchConsole
                ? "はい（getServiceAccountCredentialsFromEnv）"
                : "—"
            }
          />
        </dl>
        {data.ga4.fetchError ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 whitespace-pre-wrap break-all">
            {data.ga4.fetchError}
          </pre>
        ) : null}
        {data.ga4.authDiagnostics?.clientEmailMatchesExpected === false ? (
          <p className="mt-3 text-sm text-amber-800">
            Vercel の GOOGLE_SERVICE_ACCOUNT_JSON の client_email と、GA4
            プロパティアクセス管理に登録したメールが一致していません。実際の
            client_email を GA4 に閲覧者追加するか、Vercel の JSON
            を正しいサービスアカウントへ差し替えてください。
          </p>
        ) : null}
      </OpsSectionCard>

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

function DiagItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-all font-medium text-foreground">{value}</dd>
    </div>
  );
}
