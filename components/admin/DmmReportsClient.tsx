"use client";

import { useRef, useState, useTransition } from "react";
import { OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  OpsKpiCard,
  formatSeoNumber,
  formatSeoPercent,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type {
  DmmAdminStatus,
} from "@/lib/admin/dmm-affiliate-service";
import type { DmmAffiliatePeriod } from "@/lib/admin/dmm-report-types";

type DmmReportsClientProps = {
  initialStatus: DmmAdminStatus;
};

const PERIODS: Array<{ id: DmmAffiliatePeriod; label: string }> = [
  { id: "today", label: "今日" },
  { id: "yesterday", label: "昨日" },
  { id: "7d", label: "7日" },
  { id: "28d", label: "28日" },
  { id: "90d", label: "90日" },
];

export function DmmReportsClient({ initialStatus }: DmmReportsClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState<DmmAffiliatePeriod>("28d");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const metrics = status.dashboard.periods[period];
  const labels = status.dashboard.daily.map((row) => row.date.slice(5));

  async function reloadStatus() {
    const response = await fetch("/api/admin/dmm/status");
    const json = (await response.json()) as {
      success?: boolean;
      data?: DmmAdminStatus;
      error?: string;
    };
    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "ステータス取得に失敗しました。");
    }
    setStatus(json.data);
  }

  function upload(file: File, format: "json" | "csv") {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("format", format);
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
        };
        if (!response.ok || !json.success) {
          throw new Error(json.error ?? "アップロードに失敗しました。");
        }
        await reloadStatus();
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
        if (jsonInputRef.current) jsonInputRef.current.value = "";
        if (csvInputRef.current) csvInputRef.current.value = "";
      }
    });
  }

  function refresh() {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      try {
        const response = await fetch("/api/admin/dmm/refresh", {
          method: "POST",
        });
        const json = (await response.json()) as {
          success?: boolean;
          data?: DmmAdminStatus;
          error?: string;
        };
        if (!response.ok || !json.data) {
          throw new Error(json.error ?? "更新に失敗しました。");
        }
        setStatus(json.data);
        setMessage("データを再集計しました。");
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "更新に失敗しました。",
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            DMMアフィリエイト成果
          </h1>
          <p className="mt-2 text-sm text-muted">
            自動取得: DMM_AFFILIATE_REPORT_URL → JSON → CSV。手動アップロードも併用可。
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "処理中…" : "更新"}
        </button>
      </section>

      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OpsKpiCard
          label="最終取込日時"
          value={formatSeoDateTime(status.importedAt ?? status.updatedAt)}
        />
        <OpsKpiCard
          label="データ件数"
          value={formatSeoNumber(status.rowCount)}
        />
        <OpsKpiCard
          label="取込期間"
          value={
            status.dateRange.start && status.dateRange.end
              ? `${status.dateRange.start} 〜 ${status.dateRange.end}`
              : "—"
          }
        />
        <OpsKpiCard
          label="ソース"
          value={status.source ?? "未取込"}
        />
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-foreground">アップロード</h2>
        <p className="mt-2 text-sm text-muted">
          同一日付は上書き更新されます。列名の揺れ（日付 / clicks / 成果件数
          など）にも対応しています。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
            JSONアップロード
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file, "json");
              }}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
            CSVアップロード
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file, "csv");
              }}
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg bg-surface/50 p-3 text-xs text-muted">
          <p className="font-medium text-foreground">JSON例</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{`{
  "daily": [
    { "date": "2026-07-01", "clicks": 120, "sales": 3, "reward": 4500, "category_reward": 3000, "direct_reward": 1500 }
  ],
  "entities": [
    { "kind": "work", "key": "abc", "name": "作品名", "clicks": 40, "sales": 2, "reward": 3000 }
  ]
}`}</pre>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                period === item.id
                  ? "bg-accent text-white"
                  : "bg-surface text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <OpsKpiCard label="クリック数" value={formatSeoNumber(metrics.clicks)} />
          <OpsKpiCard
            label="成果件数"
            value={formatSeoNumber(metrics.conversions)}
          />
          <OpsKpiCard label="報酬" value={formatYen(metrics.reward)} />
          <OpsKpiCard
            label="成果率"
            value={formatSeoPercent(metrics.conversionRate)}
          />
          <OpsKpiCard
            label="クリック単価"
            value={formatYen(metrics.clickUnitPrice)}
          />
          <OpsKpiCard
            label="成果単価"
            value={formatYen(metrics.conversionUnitPrice)}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <OpsLineChart
            labels={labels}
            series={[
              {
                label: "クリック推移",
                data: status.dashboard.daily.map((row) => row.clicks),
                color: "#2563eb",
              },
            ]}
          />
          <OpsLineChart
            labels={labels}
            series={[
              {
                label: "成果推移",
                data: status.dashboard.daily.map((row) => row.conversions),
                color: "#16a34a",
              },
            ]}
          />
          <OpsLineChart
            labels={labels}
            series={[
              {
                label: "報酬推移",
                data: status.dashboard.daily.map((row) => row.reward),
                color: "#c2410c",
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">AI分析: 成果率が高い作品</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {status.dashboard.insights.highConversionWorks.map((row) => (
              <li key={row.key}>
                {row.name} — {(row.conversion_rate * 100).toFixed(1)}%
              </li>
            ))}
            {status.dashboard.insights.highConversionWorks.length === 0 ? (
              <li className="text-muted">
                entities 配列を含めて取り込むと表示されます
              </li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">AI分析: 成果率が低い作品</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {status.dashboard.insights.lowConversionWorks.map((row) => (
              <li key={row.key}>
                {row.name} — クリック {row.clicks} / 成果 {row.sales}
              </li>
            ))}
            {status.dashboard.insights.lowConversionWorks.length === 0 ? (
              <li className="text-muted">データなし</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">報酬の多いジャンル / 女優 / メーカー</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {status.dashboard.insights.topRewardGenres.map((row) => (
              <li key={`g-${row.key}`}>
                ジャンル: {row.name}（¥{Math.round(row.reward).toLocaleString("ja-JP")}）
              </li>
            ))}
            {status.dashboard.insights.topRewardActresses.map((row) => (
              <li key={`a-${row.key}`}>
                女優: {row.name}（¥{Math.round(row.reward).toLocaleString("ja-JP")}）
              </li>
            ))}
            {status.dashboard.insights.topRewardMakers.map((row) => (
              <li key={`m-${row.key}`}>
                メーカー: {row.name}（¥{Math.round(row.reward).toLocaleString("ja-JP")}）
              </li>
            ))}
            {status.dashboard.insights.topRewardGenres.length === 0 &&
            status.dashboard.insights.topRewardActresses.length === 0 &&
            status.dashboard.insights.topRewardMakers.length === 0 ? (
              <li className="text-muted">データなし</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
