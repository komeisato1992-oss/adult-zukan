"use client";

import { useRef, useState, useTransition } from "react";
import { OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  OpsKpiCard,
  formatSeoNumber,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import { buildTypeBreakdown } from "@/lib/admin/dmm-metrics";
import type { DmmAdminStatus } from "@/lib/admin/dmm-affiliate-service";
import type { DmmAffiliatePeriod } from "@/lib/admin/dmm-report-types";
import type { OpsDashboardPayload } from "@/lib/admin/ops-types";

type DmmReportsClientProps = {
  initialStatus: DmmAdminStatus;
};

const PERIODS: Array<{ id: DmmAffiliatePeriod; label: string }> = [
  { id: "today", label: "今日" },
  { id: "7d", label: "7日" },
  { id: "28d", label: "28日" },
  { id: "365d", label: "365日" },
];

export function DmmReportsClient({ initialStatus }: DmmReportsClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState<DmmAffiliatePeriod>("7d");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);

  const metrics = status.dashboard.periods[period];
  const breakdown = buildTypeBreakdown(metrics);
  const labels = status.dashboard.daily.map((row) => row.date.slice(5));

  function upload(file: File, type: "category" | "direct") {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("type", type);
        const response = await fetch("/api/admin/dmm/upload", {
          method: "POST",
          body,
        });
        const json = (await response.json()) as {
          success?: boolean;
          error?: string;
          inserted?: number;
          updated?: number;
          total?: number;
          data?: OpsDashboardPayload;
        };
        if (!response.ok || !json.success) {
          throw new Error(json.error ?? "アップロードに失敗しました。");
        }
        if (json.data?.dmm) {
          setStatus({
            updatedAt: json.data.dmm.updatedAt,
            importedAt: json.data.dmm.importedAt,
            lastSuccessfulAt: json.data.dmm.lastSuccessfulAt,
            rowCount: json.data.dmm.rowCount,
            dateRange: json.data.dmm.dateRange,
            source: json.data.dmm.source,
            fileName: json.data.dmm.fileName,
            autoConfigured: false,
            dashboard: json.data.dmm,
          });
        }
        setMessage(
          `取込完了: 新規 ${json.inserted ?? 0} / 更新 ${json.updated ?? 0} / 合計 ${json.total ?? 0} 件`,
        );
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "アップロードに失敗しました。",
        );
      } finally {
        if (categoryInputRef.current) categoryInputRef.current.value = "";
        if (directInputRef.current) directInputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold">
            DMM成果取込
          </h1>
          <p className="mt-2 text-sm text-muted">
            カテゴリCSV / ダイレクトCSVのみ対応。取込後すぐにダッシュボードへ反映されます。
          </p>
          <p className="mt-1 text-xs text-muted">
            最終取込: {formatSeoDateTime(status.updatedAt)}
          </p>
        </div>
        <a href="/admin?tab=dmm" className="text-sm font-semibold text-accent underline">
          運営ダッシュボードのDMMタブへ
        </a>
      </section>

      {message ? (
        <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="font-bold">CSVアップロード</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => categoryInputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            カテゴリCSV
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => directInputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            ダイレクトCSV
          </button>
        </div>
        <input
          ref={categoryInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file, "category");
          }}
        />
        <input
          ref={directInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file, "direct");
          }}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPeriod(option.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              period === option.id
                ? "bg-accent text-white"
                : "border border-border bg-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsKpiCard label="総報酬" value={formatYen(metrics.reward)} />
        <OpsKpiCard label="成果件数" value={formatSeoNumber(metrics.count)} />
        <OpsKpiCard label="販売金額" value={formatYen(metrics.sales)} />
        <OpsKpiCard label="平均報酬" value={formatYen(metrics.avgReward)} />
      </div>

      <OpsLineChart
        labels={labels}
        series={[
          {
            label: "カテゴリ報酬",
            data: status.dashboard.daily.map((row) => row.categoryReward),
            color: "#2563eb",
          },
          {
            label: "ダイレクト報酬",
            data: status.dashboard.daily.map((row) => row.directReward),
            color: "#c2410c",
          },
          {
            label: "合計報酬",
            data: status.dashboard.daily.map((row) => row.reward),
            color: "#16a34a",
          },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
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
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">{formatSeoNumber(row.count)}</td>
                <td className="px-3 py-2">{formatYen(row.sales)}</td>
                <td className="px-3 py-2">{formatYen(row.reward)}</td>
                <td className="px-3 py-2">{formatYen(row.avgReward)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
