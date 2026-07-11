"use client";

import { useMemo } from "react";
import { SeoChancesSection } from "@/components/admin/seo/SeoChancesSection";
import { SeoEntityRankingsSection } from "@/components/admin/seo/SeoEntityRankingsSection";
import { SeoIndexOverview } from "@/components/admin/seo/SeoIndexOverview";
import { SeoKpiGrid } from "@/components/admin/seo/SeoKpiGrid";
import { SeoNewWorksSection } from "@/components/admin/seo/SeoNewWorksSection";
import { SeoPerformanceChart } from "@/components/admin/seo/SeoPerformanceChart";
import { SeoPopularPagesSection } from "@/components/admin/seo/SeoPopularPagesSection";
import { SeoRisingQueriesSection } from "@/components/admin/seo/SeoRisingQueriesSection";
import { SeoSitemapCrawlSummary } from "@/components/admin/seo/SeoSitemapCrawlSummary";
import { SeoWeeklySuggestions } from "@/components/admin/seo/SeoWeeklySuggestions";
import {
  buildEntityRankings,
  buildRisingQueries,
  buildSeoOpportunities,
  buildWeeklySuggestions,
  getPeriodBundle,
} from "@/lib/admin/seo-insights";
import type {
  SeoCachePayload,
  SeoChanceTabId,
  SeoPeriodDays,
  SeoTabId,
} from "@/lib/admin/seo-types";

type SeoOverviewTabProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
  chanceTab?: SeoChanceTabId;
  onChanceTabChange?: (tab: SeoChanceTabId) => void;
  onNavigate?: (options: {
    tab?: SeoTabId;
    chanceTab?: SeoChanceTabId;
  }) => void;
};

export function SeoOverviewTab({
  data,
  period,
  chanceTab,
  onChanceTabChange,
  onNavigate,
}: SeoOverviewTabProps) {
  const bundle = getPeriodBundle(data, period);

  const actressRankings = useMemo(
    () =>
      buildEntityRankings(
        bundle.pages,
        bundle.previousPages,
        "/actresses/",
        data.entityWorkCounts.actresses,
        15,
      ),
    [bundle.pages, bundle.previousPages, data.entityWorkCounts.actresses],
  );

  const makerRankings = useMemo(
    () =>
      buildEntityRankings(
        bundle.pages,
        bundle.previousPages,
        "/makers/",
        data.entityWorkCounts.makers,
        15,
      ),
    [bundle.pages, bundle.previousPages, data.entityWorkCounts.makers],
  );

  const genreRankings = useMemo(
    () =>
      buildEntityRankings(
        bundle.pages,
        bundle.previousPages,
        "/genres/",
        data.entityWorkCounts.genres,
        15,
      ),
    [bundle.pages, bundle.previousPages, data.entityWorkCounts.genres],
  );

  const suggestions = useMemo(() => {
    const opportunities = buildSeoOpportunities(
      bundle.queries,
      bundle.previousQueries,
      bundle.pages,
      bundle.previousPages,
    );
    const rising = buildRisingQueries(
      bundle.queries,
      bundle.previousQueries,
      5,
    );
    return buildWeeklySuggestions(
      opportunities,
      rising,
      actressRankings,
      {
        impressions: bundle.current.impressions,
        previousImpressions: bundle.previous.impressions,
      },
      period,
    );
  }, [bundle, actressRankings, period]);

  return (
    <div className="space-y-10">
      <SeoKpiGrid data={data} period={period} />
      <SeoPerformanceChart data={data} period={period} />
      <SeoWeeklySuggestions suggestions={suggestions} onNavigate={onNavigate} />
      <SeoChancesSection
        data={data}
        period={period}
        activeTab={chanceTab}
        onTabChange={onChanceTabChange}
      />
      <SeoRisingQueriesSection data={data} period={period} />
      <SeoPopularPagesSection data={data} period={period} />
      <SeoIndexOverview data={data} />
      <SeoNewWorksSection data={data} />
      <SeoEntityRankingsSection title="女優ランキング" rows={actressRankings} />
      <SeoEntityRankingsSection title="メーカーランキング" rows={makerRankings} />
      <SeoEntityRankingsSection title="ジャンルランキング" rows={genreRankings} />
      <SeoSitemapCrawlSummary data={data} />
    </div>
  );
}
