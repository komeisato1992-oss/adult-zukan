"use client";

import { useMemo, useState } from "react";
import { SeoLineChart } from "@/components/admin/seo/SeoLineChart";
import { SeoStatCard } from "@/components/admin/seo/SeoStatCard";
import {
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import type { SeoCachePayload, SeoPeriodDays } from "@/lib/admin/seo-types";

type SeoOverviewTabProps = {
  data: SeoCachePayload;
};

const PERIOD_OPTIONS: SeoPeriodDays[] = [7, 28, 90];

export function SeoOverviewTab({ data }: SeoOverviewTabProps) {
  const [period, setPeriod] = useState<SeoPeriodDays>(28);

  const chartData = useMemo(() => {
    const sliced = data.dailyStats.slice(-period);
    return {
      labels: sliced.map((row) => row.date),
      clicks: sliced.map((row) => row.clicks),
      impressions: sliced.map((row) => row.impressions),
    };
  }, [data.dailyStats, period]);

  return (
    <div className="space-y-8">
      {data.aiSuggestions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">AI改善提案</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.aiSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-xl border border-border bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-accent">
                  {suggestion.severity}
                </p>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  {suggestion.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{suggestion.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SeoStatCard
          label="総作品数"
          value={formatSeoNumber(data.overview.totalWorks)}
        />
        <SeoStatCard
          label="Google登録ページ数"
          value={formatSeoNumber(data.overview.indexedPages)}
        />
        <SeoStatCard
          label="クリック数（28日）"
          value={formatSeoNumber(data.overview.clicks28d)}
        />
        <SeoStatCard
          label="表示回数（28日）"
          value={formatSeoNumber(data.overview.impressions28d)}
        />
        <SeoStatCard
          label="平均CTR"
          value={formatSeoPercent(data.overview.ctr28d)}
        />
        <SeoStatCard
          label="平均掲載順位"
          value={formatSeoPosition(data.overview.position28d)}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">検索パフォーマンス推移</h2>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  period === option
                    ? "border-accent bg-accent text-white"
                    : "border-border text-muted"
                }`}
              >
                {option}日
              </button>
            ))}
          </div>
        </div>

        <SeoLineChart
          labels={chartData.labels}
          series={[
            {
              key: "clicks",
              label: "クリック数",
              color: "#e60012",
              values: chartData.clicks,
            },
            {
              key: "impressions",
              label: "表示回数",
              color: "#2563eb",
              values: chartData.impressions,
            },
          ]}
          emptyMessage="Search Console データ取得後にグラフが表示されます。"
        />
      </section>
    </div>
  );
}
