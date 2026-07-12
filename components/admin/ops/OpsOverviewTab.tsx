"use client";

import { useState } from "react";
import {
  OpsKpiCard,
  formatSeoNumber,
  formatSeoPercent,
  formatDuration,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import { OpsDetailLink, OpsSectionCard } from "@/components/admin/ops/OpsUi";
import { alertClass } from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import { opsTabHref, type OpsTabId } from "@/lib/admin/ops-tabs";
import type { OpsDashboardPayload, OpsTask, OpsTaskBucket } from "@/lib/admin/ops-types";

const TASK_BUCKET_LABEL: Record<OpsTaskBucket, string> = {
  urgent: "最優先",
  this_week: "今週対応",
  backlog: "余裕があれば",
};

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
  const [expandedScoreKey, setExpandedScoreKey] = useState<string | null>(null);
  const gscToday = data.seo.periods[7]
    ? {
        clicks: data.seo.dailyStats.at(-1)?.clicks ?? 0,
        impressions: data.seo.dailyStats.at(-1)?.impressions ?? 0,
        ctr: data.seo.dailyStats.at(-1)
          ? data.seo.dailyStats.at(-1)!.impressions > 0
            ? data.seo.dailyStats.at(-1)!.clicks /
              data.seo.dailyStats.at(-1)!.impressions
            : 0
          : 0,
        position: data.seo.dailyStats.at(-1)?.position ?? 0,
      }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const ga4Today = data.ga4.periods[1]?.current;
  const dmmToday = data.dmm.periods.today;
  const hasDmmData = data.dmm.rowCount > 0 && Boolean(data.dmm.lastSuccessfulAt || data.dmm.updatedAt);

  return (
    <div className="space-y-6">
      <OpsSectionCard title="今日のSEO改善提案">
        {data.suggestions.length === 0 ? (
          <p className="text-sm text-muted">今日の改善提案はまだありません。</p>
        ) : (
          <ul className="space-y-3">
            {data.suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="rounded-lg border border-border bg-surface/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-amber-600">
                    優先度 {suggestion.priority}
                  </span>
                  <span className="text-amber-600">{suggestion.stars}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{suggestion.text}</p>
              </li>
            ))}
          </ul>
        )}
      </OpsSectionCard>

      <OpsSectionCard title="アラート">
        {data.alerts.length === 0 ? (
          <p className="text-sm text-muted">現在表示するアラートはありません。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${alertClass(alert.severity)}`}
              >
                <p className="font-bold">{alert.title}</p>
                <p className="mt-1 text-sm">{alert.detail}</p>
              </div>
            ))}
          </div>
        )}
      </OpsSectionCard>

      <OpsSectionCard title="SEO SCORE">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-5xl font-bold text-foreground">
              {data.seoScore.total == null ? "—" : data.seoScore.total}
              <span className="ml-2 text-base font-medium text-muted">/ 100</span>
            </p>
            {data.seoScore.partial ? (
              <p className="mt-2 text-sm font-medium text-amber-700">
                一部データ未取得（取得済み {data.seoScore.earned.toFixed(1)} /{" "}
                {data.seoScore.availableMax} を100点換算）
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted">
              最終計算: {formatSeoDateTime(data.seoScore.calculatedAt)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.seoScore.categories.map((category) => {
            const open = expandedScoreKey === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setExpandedScoreKey(open ? null : category.key)}
                className="rounded-lg border border-border px-4 py-3 text-left hover:bg-surface/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-foreground">{category.label}</p>
                  <p className="text-sm font-bold text-foreground">
                    {category.available
                      ? `${category.points} / ${category.maxPoints}`
                      : "未取得"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">{category.evidence}</p>
                {open ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-foreground">
                    <p>状態: {category.statusLabel}</p>
                    <p>計算日時: {formatSeoDateTime(category.calculatedAt)}</p>
                    <p>改善: {category.improvement}</p>
                    {category.details.map((detail) => (
                      <p key={detail.label}>
                        ・{detail.label}:{" "}
                        {detail.available
                          ? `${detail.points}/${detail.maxPoints}`
                          : "未取得"}{" "}
                        （{detail.evidence}）
                      </p>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </OpsSectionCard>

      <OpsSectionCard title="サイト基本情報">
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["作品数", data.top.catalog.works],
              ["女優数", data.top.catalog.actresses],
              ["メーカー数", data.top.catalog.makers],
              ["レーベル数", data.top.catalog.labels],
              ["シリーズ数", data.top.catalog.series],
              ["ジャンル数", data.top.catalog.genres],
            ] as const
          ).map(([label, value]) => (
            <OpsKpiCard
              key={label}
              label={label}
              value={formatSeoNumber(value)}
            />
          ))}
          <OpsKpiCard
            label="Google登録ページ数"
            value={
              data.top.indexedPages == null
                ? "—"
                : formatSeoNumber(data.top.indexedPages)
            }
          />
          <OpsKpiCard
            label="インデックス対象URL数"
            value={
              data.top.indexableUrlCount == null
                ? "—"
                : formatSeoNumber(data.top.indexableUrlCount)
            }
          />
          <OpsKpiCard
            label="インデックス率"
            value={
              data.top.indexRate == null
                ? "—"
                : formatSeoPercent(data.top.indexRate)
            }
          />
        </div>
      </OpsSectionCard>

      <OpsSectionCard
        title="今日の主要指標"
        action={
          <div className="flex flex-wrap gap-2">
            <OpsDetailLink
              href={opsTabHref("search-console")}
              label="Search Console詳細"
              onClick={() => onNavigateTab("search-console")}
            />
            <OpsDetailLink
              href={opsTabHref("ga4")}
              label="GA4詳細"
              onClick={() => onNavigateTab("ga4")}
            />
            <OpsDetailLink
              href={opsTabHref("dmm")}
              label="DMM詳細"
              onClick={() => onNavigateTab("dmm")}
            />
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">Search Console</h3>
              <OpsDetailLink
                href={opsTabHref("search-console")}
                onClick={() => onNavigateTab("search-console")}
              />
            </div>
            {!data.seo.configured ? (
              <p className="text-sm text-muted">Search Console APIが未設定です。</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <OpsKpiCard label="クリック数" value={formatSeoNumber(gscToday.clicks)} />
                <OpsKpiCard label="表示回数" value={formatSeoNumber(gscToday.impressions)} />
                <OpsKpiCard label="CTR" value={formatSeoPercent(gscToday.ctr)} />
                <OpsKpiCard label="平均順位" value={gscToday.position > 0 ? gscToday.position.toFixed(1) : "—"} />
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">GA4</h3>
              <OpsDetailLink
                href={opsTabHref("ga4")}
                onClick={() => onNavigateTab("ga4")}
              />
            </div>
            {!data.ga4.configured ? (
              <p className="text-sm text-muted">GA4 APIが未設定です。</p>
            ) : !ga4Today ? (
              <p className="text-sm text-muted">GA4データをまだ取得していません。</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <OpsKpiCard label="ユーザー数" value={formatSeoNumber(ga4Today.users)} />
                <OpsKpiCard label="PV" value={formatSeoNumber(ga4Today.pageViews)} />
                <OpsKpiCard label="セッション数" value={formatSeoNumber(ga4Today.sessions)} />
                <OpsKpiCard
                  label="平均エンゲージメント時間"
                  value={formatDuration(ga4Today.avgEngagementSeconds)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">DMM</h3>
              <OpsDetailLink
                href={opsTabHref("dmm")}
                onClick={() => onNavigateTab("dmm")}
              />
            </div>
            {!hasDmmData ? (
              <p className="text-sm text-muted">DMM成果データ未取得</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <OpsKpiCard label="クリック数" value={formatSeoNumber(dmmToday.clicks)} />
                <OpsKpiCard label="成果件数" value={formatSeoNumber(dmmToday.conversions)} />
                <OpsKpiCard label="報酬" value={formatYen(dmmToday.reward)} />
                <OpsKpiCard label="成果率" value={formatSeoPercent(dmmToday.conversionRate)} />
              </div>
            )}
          </div>
        </div>
      </OpsSectionCard>

      <OpsSectionCard title="AIタスク">
        <div className="grid gap-4 lg:grid-cols-3">
          {(["urgent", "this_week", "backlog"] as OpsTaskBucket[]).map((bucket) => (
            <div
              key={bucket}
              className="rounded-lg border border-border px-3 py-3"
            >
              <h3 className="font-semibold text-foreground">
                {TASK_BUCKET_LABEL[bucket]}
              </h3>
              <ul className="mt-3 space-y-3">
                {tasks
                  .filter((task) => task.bucket === bucket)
                  .map((task) => (
                    <li key={task.id} className="rounded-lg border border-border px-3 py-2">
                      <p
                        className={`text-sm ${
                          task.completed
                            ? "text-muted line-through"
                            : "text-foreground"
                        }`}
                      >
                        {task.text}
                      </p>
                      {!task.completed ? (
                        <button
                          type="button"
                          onClick={() => onCompleteTask(task.id)}
                          className="mt-2 min-h-9 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          完了
                        </button>
                      ) : (
                        <p className="mt-2 text-xs text-green-600">完了済み</p>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </OpsSectionCard>
    </div>
  );
}
