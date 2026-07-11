"use client";

import {
  formatSeoNumber,
  formatSeoPercent,
} from "@/components/admin/seo/format";
import { SeoKpiCard } from "@/components/admin/seo/SeoKpiCard";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type { SeoCachePayload } from "@/lib/admin/seo-types";

type SeoIndexOverviewProps = {
  data: SeoCachePayload;
};

const INDEX_SOURCE_LABELS: Record<
  SeoCachePayload["index"]["indexedSource"],
  string
> = {
  sitemap: "サイトマップ推定",
  search_impressions: "検索表示確認",
  estimated: "推定",
  unavailable: "取得不可",
};

export function SeoIndexOverview({ data }: SeoIndexOverviewProps) {
  const { index, sitemaps, crawlErrors } = data;
  const sitemapUrlCount = sitemaps.reduce(
    (sum, row) => sum + row.contentsCount,
    0,
  );
  const crawlErrorCount = crawlErrors.reduce((sum, row) => sum + row.count, 0);

  const indexedValue =
    index.indexedPages !== null ? formatSeoNumber(index.indexedPages) : "—";
  const notIndexedValue =
    index.notIndexedPages !== null ? formatSeoNumber(index.notIndexedPages) : "—";
  const rateValue =
    index.registrationRate !== null
      ? formatSeoPercent(index.registrationRate)
      : "—";

  return (
    <section className="space-y-4">
      <SeoSectionHeading
        title="インデックス状況"
        description={`登録数の取得元: ${INDEX_SOURCE_LABELS[index.indexedSource]}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <SeoKpiCard
          label="総公開ページ数"
          value={formatSeoNumber(index.totalSitePages)}
        />
        <SeoKpiCard label="Google登録" value={indexedValue} />
        <SeoKpiCard
          label="未登録"
          value={notIndexedValue}
          hint={index.notIndexedPages === null ? "推定不可" : undefined}
        />
        <SeoKpiCard label="登録率" value={rateValue} />
        <SeoKpiCard
          label="サイトマップ送信URL数"
          value={sitemapUrlCount > 0 ? formatSeoNumber(sitemapUrlCount) : "—"}
        />
        <SeoKpiCard
          label="クロールエラー数"
          value={formatSeoNumber(crawlErrorCount)}
        />
      </div>
    </section>
  );
}
