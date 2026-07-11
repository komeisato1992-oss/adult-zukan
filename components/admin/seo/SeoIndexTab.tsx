"use client";

import { useMemo, useState } from "react";
import { SeoLineChart } from "@/components/admin/seo/SeoLineChart";
import { SeoKpiCard } from "@/components/admin/seo/SeoKpiCard";
import { formatSeoNumber } from "@/components/admin/seo/format";
import type { SeoIndexSnapshot, SeoPeriodDays } from "@/lib/admin/seo-types";

type SeoIndexTabProps = {
  index: SeoIndexSnapshot;
};

const PERIOD_OPTIONS: SeoPeriodDays[] = [7, 28, 90];

export function SeoIndexTab({ index }: SeoIndexTabProps) {
  const [period, setPeriod] = useState<SeoPeriodDays>(28);

  const chartData = useMemo(() => {
    const sliced = index.history.slice(-period);
    return {
      labels: sliced.map((row) => row.date),
      indexed: sliced.map((row) => row.indexedPages),
      notIndexed: sliced.map((row) => row.notIndexedPages),
      excluded: sliced.map((row) => row.excludedPages),
    };
  }, [index.history, period]);

  const indexedValue =
    index.indexedPages !== null ? formatSeoNumber(index.indexedPages) : "—";
  const notIndexedValue =
    index.notIndexedPages !== null
      ? formatSeoNumber(index.notIndexedPages)
      : "—";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SeoKpiCard label="登録済みページ数" value={indexedValue} />
        <SeoKpiCard
          label="未登録ページ数"
          value={notIndexedValue}
          hint={index.notIndexedPages === null ? "推定不可" : undefined}
        />
        <SeoKpiCard
          label="除外ページ数"
          value={formatSeoNumber(index.excludedPages)}
        />
        <SeoKpiCard
          label="サイト総ページ数"
          value={formatSeoNumber(index.totalSitePages)}
        />
      </section>

      {index.history.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
              インデックス推移
            </h2>
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
                key: "indexed",
                label: "登録済み",
                color: "#16a34a",
                values: chartData.indexed,
              },
              {
                key: "notIndexed",
                label: "未登録",
                color: "#e60012",
                values: chartData.notIndexed,
              },
              {
                key: "excluded",
                label: "除外",
                color: "#64748b",
                values: chartData.excluded,
              },
            ]}
            emptyMessage="インデックス推移データは更新後に表示されます。"
          />
        </section>
      ) : null}
    </div>
  );
}
