"use client";

import { useMemo } from "react";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  SEO_PAGE_TYPE_LABELS,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import { enrichPagesWithComparison, getPeriodBundle } from "@/lib/admin/seo-insights";
import type { SeoCachePayload, SeoPeriodDays } from "@/lib/admin/seo-types";

type SeoPopularPagesSectionProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
  limit?: number;
};

export function SeoPopularPagesSection({
  data,
  period,
  limit = 15,
}: SeoPopularPagesSectionProps) {
  const rows = useMemo(() => {
    const bundle = getPeriodBundle(data, period);
    return enrichPagesWithComparison(bundle.pages, bundle.previousPages).slice(
      0,
      limit,
    );
  }, [data, period, limit]);

  return (
    <section className="space-y-4">
      <SeoSectionHeading title="人気ページ" description="クリック数の多いページ" />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          ページデータがありません。
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <a
              key={row.url}
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-accent dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{row.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {SEO_PAGE_TYPE_LABELS[row.pageType] ?? row.pageType}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">{row.url}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{formatSeoNumber(row.clicks)} クリック</p>
                  <p>{formatSeoNumber(row.impressions)} 表示</p>
                  <p>CTR {formatSeoPercent(row.ctr)}</p>
                  <p>順位 {formatSeoPosition(row.position)}</p>
                  <p className="font-medium text-foreground">
                    {row.isNew ? "新規" : formatSeoChangePercent(row.changePercent)}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
