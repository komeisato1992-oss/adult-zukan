"use client";

import {
  formatSeoChangePercent,
  formatSeoCtrPoints,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  formatSeoPositionDelta,
} from "@/components/admin/seo/format";
import { SeoKpiCard } from "@/components/admin/seo/SeoKpiCard";
import { countSubmittedSitemaps, formatSitemapKpiValue } from "@/lib/admin/seo-sitemap-status";
import {
  computeChangePercent,
  computePositionDelta,
  getPeriodBundle,
  hasGscData,
} from "@/lib/admin/seo-insights";
import type { SeoCachePayload, SeoPeriodDays } from "@/lib/admin/seo-types";

type SeoKpiGridProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
};

function metricTone(
  delta: number | null,
  invert = false,
): "up" | "down" | "neutral" | "none" {
  if (delta === null) return "none";
  if (Math.abs(delta) < 0.05) return "neutral";
  const improved = invert ? delta < 0 : delta > 0;
  return improved ? "up" : "down";
}

export function SeoKpiGrid({ data, period }: SeoKpiGridProps) {
  const fetched = hasGscData(data);
  const bundle = getPeriodBundle(data, period);
  const { current, previous } = bundle;

  const clickChange = computeChangePercent(current.clicks, previous.clicks);
  const impressionChange = computeChangePercent(
    current.impressions,
    previous.impressions,
  );
  const positionDelta = computePositionDelta(current.position, previous.position);

  const indexedLabel =
    data.index.indexedSource === "sitemap"
      ? "サイトマップ推定"
      : data.index.indexedSource === "search_impressions"
        ? "検索表示確認"
        : undefined;

  const notIndexedValue =
    data.index.notIndexedPages !== null
      ? formatSeoNumber(data.index.notIndexedPages)
      : "—";

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      <SeoKpiCard
        label="サイトマップ"
        value={formatSitemapKpiValue(data.sitemapStatus)}
        subLabel={
          data.sitemapStatus.fetchError && !data.sitemapStatus.fetchedAt
            ? "取得失敗"
            : "Search Console"
        }
        changeTone={
          data.sitemapStatus.fetchError &&
          countSubmittedSitemaps(data.sitemapStatus).submitted === 0
            ? "down"
            : "none"
        }
      />
      <SeoKpiCard
        label="クリック数"
        value={fetched ? formatSeoNumber(current.clicks) : "—"}
        changeLabel={
          fetched
            ? `前期間比 ${formatSeoChangePercent(clickChange)}`
            : undefined
        }
        changeTone={fetched ? metricTone(clickChange) : "none"}
      />
      <SeoKpiCard
        label="表示回数"
        value={fetched ? formatSeoNumber(current.impressions) : "—"}
        changeLabel={
          fetched
            ? `前期間比 ${formatSeoChangePercent(impressionChange)}`
            : undefined
        }
        changeTone={fetched ? metricTone(impressionChange) : "none"}
      />
      <SeoKpiCard
        label="平均CTR"
        value={fetched ? formatSeoPercent(current.ctr) : "—"}
        changeLabel={
          fetched
            ? `前期間比 ${formatSeoCtrPoints(current.ctr, previous.ctr)}`
            : undefined
        }
        changeTone={
          fetched
            ? metricTone(current.ctr - previous.ctr)
            : "none"
        }
      />
      <SeoKpiCard
        label="平均掲載順位"
        value={fetched ? formatSeoPosition(current.position) : "—"}
        changeLabel={
          fetched && positionDelta !== null
            ? `前期間 ${formatSeoPosition(previous.position)} / ${formatSeoPositionDelta(current.position, previous.position)}`
            : fetched
              ? "前期間データなし"
              : undefined
        }
        changeTone={
          fetched && positionDelta !== null
            ? metricTone(positionDelta, false)
            : "none"
        }
      />
      <SeoKpiCard
        label="Google登録ページ数"
        value={
          data.index.indexedPages !== null
            ? formatSeoNumber(data.index.indexedPages)
            : "—"
        }
        subLabel={indexedLabel}
        hint={
          data.index.indexedSource === "unavailable"
            ? "取得不可"
            : undefined
        }
      />
      <SeoKpiCard
        label="未登録ページ数"
        value={notIndexedValue}
        subLabel={
          data.index.notIndexedPages === null
            ? "推定不可"
            : "総公開 − 登録推定"
        }
      />
    </section>
  );
}
