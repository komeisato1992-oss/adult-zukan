"use client";

import { useMemo, useState } from "react";
import { SeoLineChart } from "@/components/admin/seo/SeoLineChart";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import { sliceDailyStatsForPeriod } from "@/lib/admin/seo-insights";
import type { SeoCachePayload, SeoPeriodDays } from "@/lib/admin/seo-types";

type MetricKey = "clicks" | "impressions" | "ctr" | "position";

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "clicks", label: "クリック数", color: "#e60012" },
  { key: "impressions", label: "表示回数", color: "#2563eb" },
  { key: "ctr", label: "CTR", color: "#16a34a" },
  { key: "position", label: "平均順位", color: "#64748b" },
];

type SeoPerformanceChartProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
};

export function SeoPerformanceChart({ data, period }: SeoPerformanceChartProps) {
  const [selected, setSelected] = useState<MetricKey[]>(["clicks", "impressions"]);

  const chartData = useMemo(() => {
    const sliced = sliceDailyStatsForPeriod(data.dailyStats, period);
    return {
      labels: sliced.map((row) => row.date),
      clicks: sliced.map((row) => row.clicks),
      impressions: sliced.map((row) => row.impressions),
      ctr: sliced.map((row) => row.ctr * 100),
      position: sliced.map((row) => row.position),
    };
  }, [data.dailyStats, period]);

  function toggleMetric(key: MetricKey) {
    setSelected((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  const series = METRIC_OPTIONS.filter((item) => selected.includes(item.key)).map(
    (item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      values: chartData[item.key],
    }),
  );

  return (
    <section className="space-y-4">
      <SeoSectionHeading title="検索パフォーマンス推移" />

      <div className="flex flex-wrap gap-2">
        {METRIC_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggleMetric(item.key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              selected.includes(item.key)
                ? "border-accent bg-accent text-white"
                : "border-border text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <SeoLineChart
        labels={chartData.labels}
        series={series}
        emptyMessage="指定期間のSearch Consoleデータがありません。"
      />
    </section>
  );
}
