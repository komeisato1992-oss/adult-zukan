"use client";

import { useState } from "react";
import { DashboardKpiCard } from "@/components/admin/ops/DashboardKpiCard";
import {
  formatDuration,
  formatSeoNumber,
  formatSeoPercent,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import { OpsDetailLink } from "@/components/admin/ops/OpsUi";
import type { OverviewPeriodMetrics } from "@/components/admin/ops/ops-overview-period";
import { opsTabHref, type OpsTabId } from "@/lib/admin/ops-tabs";

type SourceTab = "search-console" | "ga4" | "dmm";

const TABS: Array<{ id: SourceTab; label: string }> = [
  { id: "search-console", label: "Search Console" },
  { id: "ga4", label: "GA4" },
  { id: "dmm", label: "DMM" },
];

type DashboardSourceTabsProps = {
  metrics: OverviewPeriodMetrics;
  seoConfigured: boolean;
  ga4Configured: boolean;
  hasDmmData: boolean;
  onNavigateTab: (tab: OpsTabId) => void;
};

export function DashboardSourceTabs({
  metrics,
  seoConfigured,
  ga4Configured,
  hasDmmData,
  onNavigateTab,
}: DashboardSourceTabsProps) {
  const [active, setActive] = useState<SourceTab>("search-console");

  return (
    <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">主要指標</h2>
        <OpsDetailLink
          href={opsTabHref(active)}
          label="詳細分析へ"
          onClick={() => onNavigateTab(active)}
        />
      </div>

      <div
        role="tablist"
        aria-label="データソース"
        className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 lg:hidden"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={`min-h-11 rounded-lg px-1 text-xs font-semibold sm:text-sm ${
                selected
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-white hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* スマホ: アクティブタブのみ / PC: 3カラム */}
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <SourcePanel
          className={active === "search-console" ? "block" : "hidden lg:block"}
          title="Search Console"
          configured={seoConfigured}
          emptyMessage="Search Console APIが未設定です。"
          detailHref={opsTabHref("search-console")}
          onDetail={() => onNavigateTab("search-console")}
        >
          <DashboardKpiCard
            label="クリック数"
            value={formatSeoNumber(metrics.gsc.current.clicks)}
            current={metrics.gsc.current.clicks}
            previous={metrics.gsc.previous.clicks}
          />
          <DashboardKpiCard
            label="表示回数"
            value={formatSeoNumber(metrics.gsc.current.impressions)}
            current={metrics.gsc.current.impressions}
            previous={metrics.gsc.previous.impressions}
          />
          <DashboardKpiCard
            label="CTR"
            value={formatSeoPercent(metrics.gsc.current.ctr)}
            current={metrics.gsc.current.ctr}
            previous={metrics.gsc.previous.ctr}
          />
          <DashboardKpiCard
            label="平均掲載順位"
            value={
              metrics.gsc.current.position > 0
                ? metrics.gsc.current.position.toFixed(1)
                : "—"
            }
            current={metrics.gsc.current.position}
            previous={metrics.gsc.previous.position}
            invert
          />
        </SourcePanel>

        <SourcePanel
          className={active === "ga4" ? "block" : "hidden lg:block"}
          title="GA4"
          configured={ga4Configured}
          emptyMessage="GA4 APIが未設定、または未取得です。"
          detailHref={opsTabHref("ga4")}
          onDetail={() => onNavigateTab("ga4")}
        >
          <DashboardKpiCard
            label="ユーザー数"
            value={formatSeoNumber(metrics.ga4.current.users)}
            current={metrics.ga4.current.users}
            previous={metrics.ga4.previous.users}
          />
          <DashboardKpiCard
            label="PV"
            value={formatSeoNumber(metrics.ga4.current.pageViews)}
            current={metrics.ga4.current.pageViews}
            previous={metrics.ga4.previous.pageViews}
          />
          <DashboardKpiCard
            label="セッション数"
            value={formatSeoNumber(metrics.ga4.current.sessions)}
            current={metrics.ga4.current.sessions}
            previous={metrics.ga4.previous.sessions}
          />
          <DashboardKpiCard
            label="平均エンゲージメント時間"
            value={formatDuration(metrics.ga4.current.avgEngagementSeconds)}
            current={metrics.ga4.current.avgEngagementSeconds}
            previous={metrics.ga4.previous.avgEngagementSeconds}
          />
        </SourcePanel>

        <SourcePanel
          className={active === "dmm" ? "block" : "hidden lg:block"}
          title="DMM"
          configured={hasDmmData}
          emptyMessage="DMM成果データ未取得"
          detailHref={opsTabHref("dmm")}
          onDetail={() => onNavigateTab("dmm")}
        >
          <DashboardKpiCard
            label="売上"
            value={formatYen(metrics.dmm.current.sales)}
            current={metrics.dmm.current.sales}
            previous={metrics.dmm.previous.sales}
          />
          <DashboardKpiCard
            label="報酬"
            value={formatYen(metrics.dmm.current.reward)}
            current={metrics.dmm.current.reward}
            previous={metrics.dmm.previous.reward}
          />
          <DashboardKpiCard
            label="成果件数"
            value={formatSeoNumber(metrics.dmm.current.count)}
            current={metrics.dmm.current.count}
            previous={metrics.dmm.previous.count}
          />
          <DashboardKpiCard
            label="平均報酬"
            value={formatYen(metrics.dmm.current.avgReward)}
            current={metrics.dmm.current.avgReward}
            previous={metrics.dmm.previous.avgReward}
          />
        </SourcePanel>
      </div>
    </section>
  );
}

function SourcePanel({
  className,
  title,
  configured,
  emptyMessage,
  detailHref,
  onDetail,
  children,
}: {
  className?: string;
  title: string;
  configured: boolean;
  emptyMessage: string;
  detailHref: string;
  onDetail: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 hidden items-center justify-between gap-2 lg:flex">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <OpsDetailLink href={detailHref} label="詳細" onClick={onDetail} />
      </div>
      {!configured ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">{children}</div>
      )}
    </div>
  );
}
