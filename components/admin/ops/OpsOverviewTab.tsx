"use client";

import { useMemo, useState } from "react";
import { DashboardStatusCard } from "@/components/admin/ops/DashboardStatusCard";
import { DashboardPeriodSelector } from "@/components/admin/ops/DashboardPeriodSelector";
import { DashboardKpiCard } from "@/components/admin/ops/DashboardKpiCard";
import { DashboardSourceTabs } from "@/components/admin/ops/DashboardSourceTabs";
import { SeoScoreCard } from "@/components/admin/ops/SeoScoreCard";
import { AlertSummaryCard } from "@/components/admin/ops/AlertSummaryCard";
import { SeoSuggestionList } from "@/components/admin/ops/SeoSuggestionList";
import { AiTaskList } from "@/components/admin/ops/AiTaskList";
import { OpsCollapsibleSection } from "@/components/admin/ops/OpsUi";
import {
  formatSeoNumber,
  formatSeoPercent,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import {
  OVERVIEW_PERIOD_OPTIONS,
  resolveOverviewPeriodMetrics,
  type OverviewPeriodId,
} from "@/components/admin/ops/ops-overview-period";
import { GoogleEnvPresencePanel } from "@/components/admin/GoogleEnvPresencePanel";
import type { OpsTabId } from "@/lib/admin/ops-tabs";
import type { OpsDashboardPayload, OpsTask } from "@/lib/admin/ops-types";

type OpsOverviewTabProps = {
  data: OpsDashboardPayload;
  tasks: OpsTask[];
  onCompleteTask: (id: string) => void;
  onNavigateTab: (tab: OpsTabId) => void;
};

export function OpsOverviewTab({
  data,
  tasks,
  onCompleteTask,
  onNavigateTab,
}: OpsOverviewTabProps) {
  const [period, setPeriod] = useState<OverviewPeriodId>("today");
  const metrics = useMemo(
    () => resolveOverviewPeriodMetrics(data, period),
    [data, period],
  );
  const todayMetrics = useMemo(
    () => resolveOverviewPeriodMetrics(data, "today"),
    [data],
  );
  const hasDmmData =
    data.dmm.rowCount > 0 &&
    Boolean(data.dmm.lastSuccessfulAt || data.dmm.updatedAt);

  function scrollToAlerts() {
    const el = document.getElementById("ops-alerts");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const importantKpis = [
    {
      label: "ユーザー数",
      value: formatSeoNumber(metrics.ga4.current.users),
      current: metrics.ga4.current.users,
      previous: metrics.ga4.previous.users,
    },
    {
      label: "PV",
      value: formatSeoNumber(metrics.ga4.current.pageViews),
      current: metrics.ga4.current.pageViews,
      previous: metrics.ga4.previous.pageViews,
    },
    {
      label: "セッション数",
      value: formatSeoNumber(metrics.ga4.current.sessions),
      current: metrics.ga4.current.sessions,
      previous: metrics.ga4.previous.sessions,
    },
    {
      label: "検索表示回数",
      value: formatSeoNumber(metrics.gsc.current.impressions),
      current: metrics.gsc.current.impressions,
      previous: metrics.gsc.previous.impressions,
    },
    {
      label: "クリック数",
      value: formatSeoNumber(metrics.gsc.current.clicks),
      current: metrics.gsc.current.clicks,
      previous: metrics.gsc.previous.clicks,
    },
    {
      label: "CTR",
      value: formatSeoPercent(metrics.gsc.current.ctr),
      current: metrics.gsc.current.ctr,
      previous: metrics.gsc.previous.ctr,
    },
    {
      label: "平均掲載順位",
      value:
        metrics.gsc.current.position > 0
          ? metrics.gsc.current.position.toFixed(1)
          : "—",
      current: metrics.gsc.current.position,
      previous: metrics.gsc.previous.position,
      invert: true,
    },
    {
      label: "FANZA成果",
      value: hasDmmData
        ? formatSeoNumber(metrics.dmm.current.count)
        : "—",
      current: metrics.dmm.current.count,
      previous: metrics.dmm.previous.count,
    },
    {
      label: "収益",
      value: hasDmmData ? formatYen(metrics.dmm.current.reward) : "—",
      current: metrics.dmm.current.reward,
      previous: metrics.dmm.previous.reward,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-[1400px] space-y-3 sm:space-y-4">
      {/* 1. 今日の状態 + アラート + SEO（PC上段） */}
      <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
        <div className="lg:col-span-5">
          <DashboardStatusCard
            data={data}
            usersToday={todayMetrics.ga4.current.users}
            pvToday={todayMetrics.ga4.current.pageViews}
            revenueToday={hasDmmData ? todayMetrics.dmm.current.reward : null}
            onOpenAlerts={scrollToAlerts}
          />
        </div>
        <div className="lg:col-span-4">
          <SeoScoreCard seoScore={data.seoScore} />
        </div>
        <div className="lg:col-span-3">
          <AlertSummaryCard alerts={data.alerts} />
        </div>
      </div>

      {/* 期間 + 重要指標 */}
      <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">重要指標</h2>
          <p className="text-xs text-muted">
            {period === "30" ? "30日表示は28日データを使用" : null}
          </p>
        </div>
        <DashboardPeriodSelector
          options={OVERVIEW_PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-3">
          {importantKpis.map((kpi) => (
            <DashboardKpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              current={"current" in kpi ? kpi.current : undefined}
              previous={"previous" in kpi ? kpi.previous : undefined}
              invert={"invert" in kpi ? kpi.invert : false}
              changeLabel={period === "today" ? "前日比" : "前期間比"}
            />
          ))}
        </div>
      </section>

      {/* Search Console / GA4 / DMM */}
      <DashboardSourceTabs
        metrics={metrics}
        seoConfigured={data.seo.configured}
        ga4Configured={data.ga4.configured && Boolean(metrics.ga4.current)}
        hasDmmData={hasDmmData}
        onNavigateTab={onNavigateTab}
      />

      {/* 下段: サイト基本 / SEO提案 / AIタスク */}
      <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
        <div className="lg:col-span-4">
          <OpsCollapsibleSection
            title="サイト基本指標"
            summary={`作品 ${formatSeoNumber(data.top.catalog.works)} / インデックス ${
              data.top.indexedPages == null
                ? "—"
                : formatSeoNumber(data.top.indexedPages)
            }`}
            defaultOpen={false}
          >
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["掲載中作品数", data.top.catalog.works],
                  ["女優数", data.top.catalog.actresses],
                  ["メーカー数", data.top.catalog.makers],
                  ["レーベル数", data.top.catalog.labels],
                  ["シリーズ数", data.top.catalog.series],
                  ["ジャンル数", data.top.catalog.genres],
                ] as const
              ).map(([label, value]) => (
                <DashboardKpiCard
                  key={label}
                  label={label}
                  value={formatSeoNumber(value)}
                />
              ))}
              <DashboardKpiCard
                label="Google登録ページ数"
                value={
                  data.top.indexedPages == null
                    ? "—"
                    : formatSeoNumber(data.top.indexedPages)
                }
              />
              <DashboardKpiCard
                label="インデックス対象URL数"
                value={
                  data.top.indexableUrlCount == null
                    ? "—"
                    : formatSeoNumber(data.top.indexableUrlCount)
                }
              />
              <DashboardKpiCard
                label="インデックス率"
                value={
                  data.top.indexRate == null
                    ? "—"
                    : formatSeoPercent(data.top.indexRate)
                }
              />
            </div>
          </OpsCollapsibleSection>
        </div>

        <div className="lg:col-span-4">
          <SeoSuggestionList suggestions={data.suggestions} />
        </div>

        <div className="lg:col-span-4">
          <AiTaskList tasks={tasks} onCompleteTask={onCompleteTask} />
        </div>
      </div>

      <OpsCollapsibleSection
        title="詳細設定・補助情報"
        summary="Google環境変数の確認"
        defaultOpen={false}
      >
        <GoogleEnvPresencePanel />
      </OpsCollapsibleSection>
    </div>
  );
}
