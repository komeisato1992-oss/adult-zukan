"use client";

import { useMemo } from "react";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import { buildRisingQueries, getPeriodBundle } from "@/lib/admin/seo-insights";
import type { SeoCachePayload, SeoPeriodDays } from "@/lib/admin/seo-types";

type SeoRisingQueriesSectionProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
  limit?: number;
};

export function SeoRisingQueriesSection({
  data,
  period,
  limit = 20,
}: SeoRisingQueriesSectionProps) {
  const rows = useMemo(() => {
    const bundle = getPeriodBundle(data, period);
    return buildRisingQueries(bundle.queries, bundle.previousQueries, limit);
  }, [data, period, limit]);

  return (
    <section className="space-y-4">
      <SeoSectionHeading
        title="急上昇クエリ"
        description="前期間比で伸びている検索語"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          急上昇クエリはありません。
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.keyword}
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-foreground">
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="line-clamp-2 font-medium text-foreground"
                  title={row.keyword}
                >
                  {row.keyword}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatSeoNumber(row.clicks)}クリック /{" "}
                  {formatSeoNumber(row.impressions)}表示 / CTR{" "}
                  {formatSeoPercent(row.ctr)} / 順位{" "}
                  {formatSeoPosition(row.position)}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm font-medium text-green-600">
                {row.isNew ? "新規" : formatSeoChangePercent(row.changePercent)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
