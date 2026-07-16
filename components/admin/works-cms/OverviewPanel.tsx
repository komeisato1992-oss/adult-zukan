"use client";

import { useState } from "react";
import {
  formatDateTime,
  toneCardClass,
  toneDotClass,
} from "@/components/admin/works-cms/format";
import type { WorksCmsOverview } from "@/components/admin/works-cms/types";

type OverviewPanelProps = {
  overview: WorksCmsOverview | null;
  onRefresh: () => void;
};

type Metric = {
  label: string;
  value: string;
  tone: "ok" | "running" | "warn" | "error" | "unset" | "info";
  detail?: string;
};

export function WorksCmsOverviewPanel({
  overview,
  onRefresh,
}: OverviewPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!overview) {
    return (
      <section className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted">
        運用状況を読込中…
      </section>
    );
  }

  const primary: Metric[] = [
    {
      label: "公開",
      value: overview.publishedCount.toLocaleString(),
      tone: "ok",
    },
    {
      label: "非公開",
      value: overview.unpublishedCount.toLocaleString(),
      tone: overview.unpublishedCount > 0 ? "warn" : "ok",
    },
    {
      label: "画像なし",
      value: overview.noPackageImageCount.toLocaleString(),
      tone: overview.noPackageImageCount > 0 ? "warn" : "ok",
    },
    {
      label: "販売終了",
      value: overview.unavailableCount.toLocaleString(),
      tone: overview.unavailableCount > 0 ? "warn" : "ok",
    },
    {
      label: "マスター",
      value: overview.worksMasterCount.toLocaleString(),
      tone: overview.worksMasterCount > 0 ? "ok" : "unset",
    },
    {
      label: "変動情報",
      value: overview.liveStatusCount.toLocaleString(),
      tone: overview.liveInitComplete ? "ok" : "warn",
    },
  ];

  const secondary: Metric[] = [
    {
      label: "未初期化",
      value: overview.missingLiveCount.toLocaleString(),
      tone: overview.missingLiveCount > 0 ? "warn" : "ok",
      detail: `初期化率 ${overview.initRatePercent}%`,
    },
    {
      label: "最終追加",
      value: formatDateTime(overview.lastWorkAddedAt),
      tone: overview.lastWorkAddedAt ? "ok" : "unset",
    },
    {
      label: "最終更新",
      value: formatDateTime(overview.lastLightSyncAt),
      tone: overview.lastLightSyncAt ? "ok" : "unset",
    },
    {
      label: "実行中",
      value: overview.runningJobLabel ?? "なし",
      tone: overview.runningJobLabel ? "running" : "ok",
    },
    {
      label: "直近エラー",
      value: String(overview.errorCount),
      tone: overview.errorCount > 0 ? "error" : "ok",
    },
  ];

  const visible = expanded ? [...primary, ...secondary] : primary;

  return (
    <section className={`rounded-xl border px-3 py-2.5 ${toneCardClass(overview.tone)}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${toneDotClass(overview.tone)}`}
            aria-hidden
          />
          <p className="text-sm font-bold">運用状況</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button type="button" className="underline" onClick={onRefresh}>
            更新
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "閉じる" : "詳細を見る"}
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {visible.map((m) => (
          <div
            key={m.label}
            className={`rounded-lg border px-2 py-1.5 ${toneCardClass(m.tone)}`}
          >
            <p className="text-[10px] font-medium opacity-80">{m.label}</p>
            <p className="truncate text-sm font-bold tabular-nums leading-tight">
              {m.value}
            </p>
            {expanded && m.detail ? (
              <p className="truncate text-[10px] opacity-70">{m.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
