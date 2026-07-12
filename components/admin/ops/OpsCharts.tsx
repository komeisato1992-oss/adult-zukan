"use client";

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

type LineSeries = {
  label: string;
  data: number[];
  color: string;
};

type OpsLineChartProps = {
  labels: string[];
  series: LineSeries[];
  emptyMessage?: string;
};

export function OpsLineChart({
  labels,
  series,
  emptyMessage = "表示できるデータがありません。",
}: OpsLineChartProps) {
  if (labels.length === 0 || series.every((item) => item.data.length === 0)) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="h-64 rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <Line
        data={{
          labels,
          datasets: series.map((item) => ({
            label: item.label,
            data: item.data,
            borderColor: item.color,
            backgroundColor: `${item.color}22`,
            tension: 0.3,
            fill: false,
            pointRadius: 2,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 8 },
            },
            y: {
              beginAtZero: true,
            },
          },
        }}
      />
    </div>
  );
}

type OpsDoughnutChartProps = {
  labels: string[];
  values: number[];
  colors: string[];
  emptyMessage?: string;
};

export function OpsDoughnutChart({
  labels,
  values,
  colors,
  emptyMessage = "表示できるデータがありません。",
}: OpsDoughnutChartProps) {
  if (values.every((value) => value <= 0)) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="mx-auto h-64 max-w-sm rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
          },
        }}
      />
    </div>
  );
}
