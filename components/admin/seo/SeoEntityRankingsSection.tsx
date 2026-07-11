"use client";

import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type { SeoEntityRankingRow } from "@/lib/admin/seo-types";

type SeoEntityRankingsSectionProps = {
  title: string;
  rows: SeoEntityRankingRow[];
};

export function SeoEntityRankingsSection({
  title,
  rows,
}: SeoEntityRankingsSectionProps) {
  return (
    <section className="space-y-4">
      <SeoSectionHeading title={title} />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          データがありません。
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <a
              key={row.url}
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-accent dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatSeoNumber(row.clicks)} クリック /{" "}
                  {formatSeoNumber(row.impressions)} 表示 / CTR{" "}
                  {formatSeoPercent(row.ctr)} / 順位{" "}
                  {formatSeoPosition(row.position)}
                  {row.workCount !== null
                    ? ` / 掲載作品 ${formatSeoNumber(row.workCount)}`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-sm font-medium text-foreground">
                {formatSeoChangePercent(row.changePercent)}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
