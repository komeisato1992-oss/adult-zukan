"use client";

import { useRef } from "react";
import { OpsLineChart } from "@/components/admin/ops/OpsCharts";
import {
  OpsKpiCard,
  formatSeoNumber,
  formatSeoPercent,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import {
  OpsDataStatusBanner,
  OpsEmptyState,
  OpsPeriodButtons,
  OpsSectionCard,
} from "@/components/admin/ops/OpsUi";
import { deriveDmmDataStatus } from "@/components/admin/ops/ops-dashboard-utils";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsDashboardPayload, OpsDmmPeriod } from "@/lib/admin/ops-types";

const DMM_PERIODS: Array<{ id: OpsDmmPeriod; label: string }> = [
  { id: "today", label: "今日" },
  { id: "yesterday", label: "昨日" },
  { id: "7d", label: "7日" },
  { id: "28d", label: "28日" },
  { id: "90d", label: "90日" },
];

type OpsDmmTabProps = {
  data: OpsDashboardPayload;
  period: OpsDmmPeriod;
  onPeriodChange: (period: OpsDmmPeriod) => void;
  refreshing: boolean;
  onRefresh: () => void;
  uploadPending: boolean;
  onUpload: (file: File, format: "json" | "csv") => void;
};

export function OpsDmmTab({
  data,
  period,
  onPeriodChange,
  refreshing,
  onRefresh,
  uploadPending,
  onUpload,
}: OpsDmmTabProps) {
  const status = deriveDmmDataStatus(data.dmm, refreshing, formatSeoDateTime);
  const metrics = data.dmm.periods[period];
  const dmmLabels = data.dmm.daily.map((row) => row.date.slice(5));
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const hasData =
    status.kind === "ok" || status.kind === "stale" || status.kind === "refreshing";
  const works = data.dmm.rankings?.works ?? [];
  const actresses = data.dmm.rankings?.actresses ?? [];
  const makers = data.dmm.insights?.topRewardMakers ?? [];
  const genres = data.dmm.insights?.topRewardGenres ?? [];
  const hasAnyRanking =
    works.length > 0 || actresses.length > 0 || makers.length > 0 || genres.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OpsPeriodButtons
          options={DMM_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || uploadPending}
          className="min-h-11 shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {refreshing ? "更新中…" : "DMM成果を更新"}
        </button>
      </div>

      <OpsDataStatusBanner status={status} />

      <OpsSectionCard title="操作">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            disabled={uploadPending}
            className="min-h-11 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-red-50 disabled:opacity-60"
          >
            JSONアップロード
          </button>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            disabled={uploadPending}
            className="min-h-11 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-red-50 disabled:opacity-60"
          >
            CSVアップロード
          </button>
          <a
            href="/admin/dmm"
            className="inline-flex min-h-11 items-center rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-red-50"
          >
            取込管理ページ
          </a>
        </div>
        <input
          ref={jsonInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file, "json");
            event.target.value = "";
          }}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file, "csv");
            event.target.value = "";
          }}
        />
      </OpsSectionCard>

      {!hasData ? (
        <OpsEmptyState
          message={
            status.kind === "unconfigured"
              ? "DMM成果の自動取得が未設定です。JSON/CSVアップロードか環境変数を設定してください。"
              : "DMM成果データ未取得"
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
            <OpsKpiCard label="クリック数" value={formatSeoNumber(metrics.clicks)} />
            <OpsKpiCard label="成果件数" value={formatSeoNumber(metrics.conversions)} />
            <OpsKpiCard label="成果率" value={formatSeoPercent(metrics.conversionRate)} />
            <OpsKpiCard label="報酬" value={formatYen(metrics.reward)} />
            <OpsKpiCard label="クリック単価" value={formatYen(metrics.clickUnitPrice)} />
            <OpsKpiCard label="成果単価" value={formatYen(metrics.conversionUnitPrice)} />
          </div>

          {data.dmm.daily.length === 0 ? (
            <OpsEmptyState message="日別推移データはまだありません" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <OpsLineChart
                labels={dmmLabels}
                series={[
                  {
                    label: "クリック推移",
                    data: data.dmm.daily.map((row) => row.clicks),
                    color: "#2563eb",
                  },
                ]}
              />
              <OpsLineChart
                labels={dmmLabels}
                series={[
                  {
                    label: "成果件数推移",
                    data: data.dmm.daily.map((row) => row.conversions),
                    color: "#16a34a",
                  },
                ]}
              />
              <OpsLineChart
                labels={dmmLabels}
                series={[
                  {
                    label: "報酬推移",
                    data: data.dmm.daily.map((row) => row.reward),
                    color: "#c2410c",
                  },
                ]}
              />
            </div>
          )}

          <OpsSectionCard title="内訳">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
              <OpsKpiCard label="ダイレクト報酬" value={formatYen(metrics.directReward)} />
              <OpsKpiCard
                label="カテゴリー報酬"
                value={formatYen(metrics.categoryReward)}
              />
              <OpsKpiCard
                label="サービス新規報酬"
                value="—"
              >
                <p className="text-xs text-muted">レポート項目が無いため未取得</p>
              </OpsKpiCard>
            </div>
          </OpsSectionCard>

          {hasAnyRanking ? (
            <OpsSectionCard title="ランキング">
              <div className="grid gap-4 xl:grid-cols-2">
                <RankingList title="作品別成果" rows={works} empty="作品別成果はまだありません" />
                <RankingList
                  title="女優別成果"
                  rows={actresses}
                  empty="女優別成果はまだありません"
                />
                <RankingList title="メーカー別成果" rows={makers} empty="メーカー別成果はまだありません" />
                <RankingList title="ジャンル別成果" rows={genres} empty="ジャンル別成果はまだありません" />
              </div>
            </OpsSectionCard>
          ) : (
            <OpsEmptyState message="ランキングデータはまだありません（entities付きレポート取込で表示）" />
          )}

          <OpsSectionCard title="データ取得状態">
            <dl className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
              <StatusItem label="最終取得日時" value={formatSeoDateTime(data.dmm.lastSuccessfulAt ?? data.dmm.updatedAt)} />
              <StatusItem
                label="取得期間"
                value={
                  data.dmm.dateRange.start && data.dmm.dateRange.end
                    ? `${data.dmm.dateRange.start} 〜 ${data.dmm.dateRange.end}`
                    : "—"
                }
              />
              <StatusItem label="ソース" value={data.dmm.source ?? "—"} />
              <StatusItem label="取得件数" value={formatSeoNumber(data.dmm.rowCount)} />
              <StatusItem
                label="成功／失敗"
                value={
                  status.kind === "ok"
                    ? "成功"
                    : status.kind === "stale"
                      ? "前回成功データを表示"
                      : status.label
                }
              />
              <StatusItem
                label="エラー内容"
                value={data.dmm.fetchError ?? "なし"}
              />
            </dl>
          </OpsSectionCard>
        </>
      )}
    </div>
  );
}

function RankingList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ key: string; name: string; reward: number; sales: number }>;
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-3">
      <p className="font-semibold text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.slice(0, 10).map((row) => (
            <li key={row.key}>
              {row.name} — {formatYen(row.reward)} / 成果 {row.sales}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
