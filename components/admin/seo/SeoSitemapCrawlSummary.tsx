"use client";

import { formatSeoNumber } from "@/components/admin/seo/format";
import { SeoKpiCard } from "@/components/admin/seo/SeoKpiCard";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import { SEO_CRAWL_ERROR_LABELS } from "@/lib/admin/seo-types";

type SeoSitemapCrawlSummaryProps = {
  data: SeoCachePayload;
};

export function SeoSitemapCrawlSummary({ data }: SeoSitemapCrawlSummaryProps) {
  const sitemapCount = data.sitemaps.length;
  const sitemapErrors = data.sitemaps.reduce((sum, row) => sum + row.errors, 0);
  const crawlErrorCount = data.crawlErrors.reduce(
    (sum, row) => sum + row.count,
    0,
  );

  return (
    <section className="space-y-4">
      <SeoSectionHeading
        title="サイトマップ・クロールエラー"
        description="詳細は各タブで確認できます"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <SeoKpiCard
          label="サイトマップ数"
          value={sitemapCount > 0 ? formatSeoNumber(sitemapCount) : "—"}
        />
        <SeoKpiCard
          label="サイトマップエラー"
          value={formatSeoNumber(sitemapErrors)}
        />
        <SeoKpiCard
          label="クロールエラー"
          value={formatSeoNumber(crawlErrorCount)}
        />
      </div>

      {data.crawlErrors.some((row) => row.count > 0) ? (
        <div className="space-y-2">
          {data.crawlErrors
            .filter((row) => row.count > 0)
            .map((row) => (
              <div
                key={row.type}
                className="rounded-lg border border-border bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="font-medium text-foreground">
                  {SEO_CRAWL_ERROR_LABELS[row.type]}: {formatSeoNumber(row.count)}
                </p>
                {row.urls.length > 0 ? (
                  <p className="mt-1 truncate text-xs text-muted">
                    {row.urls.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
