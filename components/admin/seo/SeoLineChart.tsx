"use client";

import {
  formatSeoDate,
  formatSeoNumber,
} from "@/components/admin/seo/format";

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

type SeoLineChartProps = {
  labels: string[];
  series: ChartSeries[];
  emptyMessage?: string;
};

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 32, left: 48 };

function buildPath(values: number[], maxValue: number, innerWidth: number): string {
  if (values.length === 0) return "";

  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = PADDING.left + stepX * index;
      const ratio = maxValue > 0 ? value / maxValue : 0;
      const y =
        PADDING.top + (CHART_HEIGHT - PADDING.top - PADDING.bottom) * (1 - ratio);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function SeoLineChart({
  labels,
  series,
  emptyMessage = "表示できるデータがありません。",
}: SeoLineChartProps) {
  if (labels.length === 0 || series.every((item) => item.values.length === 0)) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
        {emptyMessage}
      </div>
    );
  }

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const maxValue = Math.max(
    1,
    ...series.flatMap((item) => item.values),
  );

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="min-w-[640px] w-full"
          role="img"
          aria-label="SEO推移グラフ"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y =
              PADDING.top +
              (CHART_HEIGHT - PADDING.top - PADDING.bottom) * ratio;
            return (
              <line
                key={ratio}
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />
            );
          })}

          {series.map((item) => (
            <path
              key={item.key}
              d={buildPath(item.values, maxValue, innerWidth)}
              fill="none"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {labels.map((label, index) => {
            if (labels.length > 12 && index % Math.ceil(labels.length / 6) !== 0) {
              return null;
            }
            const stepX = labels.length > 1 ? innerWidth / (labels.length - 1) : 0;
            const x = PADDING.left + stepX * index;
            return (
              <text
                key={`${label}-${index}`}
                x={x}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {formatSeoDate(label)}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-right text-xs text-muted">
        最大値: {formatSeoNumber(maxValue)}
      </p>
    </div>
  );
}
