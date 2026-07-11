"use client";

import { useMemo, useState } from "react";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import { buildSeoOpportunities, getPeriodBundle } from "@/lib/admin/seo-insights";
import type { SeoCachePayload, SeoChanceTabId, SeoPeriodDays } from "@/lib/admin/seo-types";
import { SEO_CHANCE_TABS } from "@/lib/admin/seo-types";

type SeoChancesSectionProps = {
  data: SeoCachePayload;
  period: SeoPeriodDays;
  activeTab?: SeoChanceTabId;
  onTabChange?: (tab: SeoChanceTabId) => void;
};

export function SeoChancesSection({
  data,
  period,
  activeTab: controlledTab,
  onTabChange,
}: SeoChancesSectionProps) {
  const [internalTab, setInternalTab] = useState<SeoChanceTabId>("ctr");
  const activeTab = controlledTab ?? internalTab;

  const opportunities = useMemo(() => {
    const bundle = getPeriodBundle(data, period);
    return buildSeoOpportunities(
      bundle.queries,
      bundle.previousQueries,
      bundle.pages,
      bundle.previousPages,
    );
  }, [data, period]);

  const rows = opportunities[activeTab];

  function setTab(tab: SeoChanceTabId) {
    setInternalTab(tab);
    onTabChange?.(tab);
  }

  return (
    <section className="space-y-4">
      <SeoSectionHeading
        title="SEOチャンス"
        description="検索流入改善につながるページや検索語の候補"
      />

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2">
          {SEO_CHANCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs ${
                activeTab === tab.id
                  ? "border-accent bg-accent text-white"
                  : "border-border text-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          該当する改善候補はありません。
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      {row.label}
                    </a>
                  ) : (
                    <p className="font-medium text-foreground">{row.label}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">{row.reason}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{formatSeoNumber(row.clicks)} クリック</p>
                  <p>{formatSeoNumber(row.impressions)} 表示</p>
                  <p>CTR {formatSeoPercent(row.ctr)}</p>
                  <p>順位 {formatSeoPosition(row.position)}</p>
                  {row.changePercent !== undefined && row.changePercent !== null ? (
                    <p>{formatSeoChangePercent(row.changePercent)}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
