"use client";

import { useRef } from "react";
import { OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  OpsKpiCard,
  formatSeoNumber,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import {
  OpsDataStatusBanner,
  OpsEmptyState,
  OpsPeriodButtons,
  OpsSectionCard,
} from "@/components/admin/ops/OpsUi";
import { deriveDmmDataStatus } from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import { buildTypeBreakdown } from "@/lib/admin/dmm-metrics";
import type { OpsDashboardPayload, OpsDmmPeriod } from "@/lib/admin/ops-types";

const DMM_PERIODS: Array<{ id: OpsDmmPeriod; label: string }> = [
  { id: "today", label: "今日" },
  { id: "7d", label: "7日" },
  { id: "28d", label: "28日" },
  { id: "365d", label: "365日" },
];

type OpsDmmTabProps = {
  data: OpsDashboardPayload;
  period: OpsDmmPeriod;
  onPeriodChange: (period: OpsDmmPeriod) => void;
  refreshing: boolean;
  onRefresh: () => void;
  uploadPending: boolean;
  onUpload: (file: File, type: "category" | "direct") => void;
};

function filterDaily(
  daily: OpsDashboardPayload["dmm"]["daily"],
  period: OpsDmmPeriod,
) {
  if (daily.length === 0) return [];
  const end = daily[daily.length - 1]?.date;
  if (!end) return [];
  const endDate = new Date(`${end}T00:00:00Z`);
  const days =
    period === "today" ? 1 : period === "7d" ? 7 : period === "28d" ? 28 : 365;
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startKey = start.toISOString().slice(0, 10);
  return daily.filter((row) => row.date >= startKey && row.date <= end);
}

export function OpsDmmTab({
  data,
  period,
  onPeriodChange,
  refreshing,
  onRefresh,
  uploadPending,
  onUpload,
}: OpsDmmTabProps) {
  const status = deriveDmmDataStatus(data.dmm, refreshing, formatSeoDateTime);
  const metrics = data.dmm.periods[period];
  const daily = filterDaily(data.dmm.daily, period);
  const labels = daily.map((row) => row.date.slice(5));
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);
  const hasData =
    status.kind === "ok" || status.kind === "stale" || status.kind === "refreshing";
  const breakdown = buildTypeBreakdown(metrics);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OpsPeriodButtons
          options={DMM_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || uploadPending}
          className="min-h-11 shrink-0 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-red-50 disabled:opacity-60"
        >
          {refreshing ? "更新中…" : "DMMを更新"}
        </button>
      </div>

      <OpsDataStatusBanner status={status} />

      <OpsSectionCard title="CSVアップロード">
        <p className="mb-3 text-sm text-muted">
          カテゴリCSV / ダイレクトCSV（日付・報酬件数・販売金額・報酬額）を取り込むと、すぐにダッシュボードへ反映されます。
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => categoryInputRef.current?.click()}
            disabled={uploadPending}
            className="min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            カテゴリCSVをアップロード
          </button>
          <button
            type="button"
            onClick={() => directInputRef.current?.click()}
            disabled={uploadPending}
            className="min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            ダイレクトCSVをアップロード
          </button>
        </div>
        <input
          ref={categoryInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file, "category");
            event.target.value = "";
          }}
        />
        <input
          ref={directInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file, "direct");
            event.target.value = "";
          }}
        />
      </OpsSectionCard>

      {!hasData ? (
        <OpsEmptyState message="DMM成果データ未取得" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <OpsKpiCard label="総報酬" value={formatYen(metrics.reward)} />
            <OpsKpiCard label="成果件数" value={formatSeoNumber(metrics.count)} />
            <OpsKpiCard label="販売金額" value={formatYen(metrics.sales)} />
            <OpsKpiCard label="平均報酬" value={formatYen(metrics.avgReward)} />
          </div>

          {daily.length === 0 ? (
            <OpsEmptyState message="日別推移データはまだありません" />
          ) : (
            <OpsLineChart
              labels={labels}
              emptyMessage="日別推移データはまだありません"
              series={[
                {
                  label: "カテゴリ報酬",
                  data: daily.map((row) => row.categoryReward),
                  color: "#2563eb",
                },
                {
                  label: "ダイレクト報酬",
                  data: daily.map((row) => row.directReward),
                  color: "#c2410c",
                },
                {
                  label: "合計報酬",
                  data: daily.map((row) => row.reward),
                  color: "#16a34a",
                },
              ]}
            />
          )}

          <OpsSectionCard title="カテゴリ・ダイレクト別集計">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface/50 text-muted">
                  <tr>
                    <th className="px-3 py-2">種別</th>
                    <th className="px-3 py-2">成果件数</th>
                    <th className="px-3 py-2">販売金額</th>
                    <th className="px-3 py-2">報酬額</th>
                    <th className="px-3 py-2">平均報酬</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.type} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2">{formatSeoNumber(row.count)}</td>
                      <td className="px-3 py-2">{formatYen(row.sales)}</td>
                      <td className="px-3 py-2">{formatYen(row.reward)}</td>
                      <td className="px-3 py-2">{formatYen(row.avgReward)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-surface/30 font-semibold">
                    <td className="px-3 py-2">合計</td>
                    <td className="px-3 py-2">{formatSeoNumber(metrics.count)}</td>
                    <td className="px-3 py-2">{formatYen(metrics.sales)}</td>
                    <td className="px-3 py-2">{formatYen(metrics.reward)}</td>
                    <td className="px-3 py-2">{formatYen(metrics.avgReward)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </OpsSectionCard>

          <OpsSectionCard title="データ取得状態">
            <dl className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
              <StatusItem
                label="最終取込日時"
                value={formatSeoDateTime(
                  data.dmm.lastSuccessfulAt ?? data.dmm.updatedAt,
                )}
              />
              <StatusItem
                label="取得期間"
                value={
                  data.dmm.dateRange.start && data.dmm.dateRange.end
                    ? `${data.dmm.dateRange.start} 〜 ${data.dmm.dateRange.end}`
                    : "—"
                }
              />
              <StatusItem label="ソース" value={data.dmm.source ?? "csv"} />
              <StatusItem
                label="取得件数"
                value={formatSeoNumber(data.dmm.rowCount)}
              />
              <StatusItem label="最新ファイル" value={data.dmm.fileName ?? "—"} />
            </dl>
          </OpsSectionCard>
        </>
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
