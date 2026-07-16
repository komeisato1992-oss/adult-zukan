"use client";

import { formatDateTime } from "@/components/admin/works-cms/format";
import type { WorksCmsOverview } from "@/components/admin/works-cms/types";

type FanzaTvTabProps = {
  overview: WorksCmsOverview | null;
};

const FUTURE_ACTIONS = [
  "未確認のみ判定",
  "unknownを再判定",
  "古い判定のみ再確認",
  "100件判定",
  "処理を再開",
  "エラーCSV",
] as const;

function displayCount(value: number | null | undefined): string {
  if (value == null) return "判定前";
  return value.toLocaleString();
}

export function WorksCmsFanzaTvTab({ overview }: FanzaTvTabProps) {
  const tv = overview?.fanzaTv;
  const hasAnyData =
    (tv?.uncheckedCount ?? 0) +
      (tv?.activeCount ?? 0) +
      (tv?.notAvailableCount ?? 0) +
      (tv?.unknownCount ?? 0) >
    0;

  const cards = [
    {
      label: "未確認",
      value: hasAnyData ? displayCount(tv?.uncheckedCount) : "判定前",
    },
    {
      label: "見放題対象",
      value: hasAnyData ? displayCount(tv?.activeCount) : "判定前",
    },
    {
      label: "対象外",
      value: hasAnyData ? displayCount(tv?.notAvailableCount) : "判定前",
    },
    {
      label: "不明",
      value: hasAnyData ? displayCount(tv?.unknownCount) : "判定前",
    },
    {
      label: "最終判定日時",
      value: tv?.lastCheckedAt ? formatDateTime(tv.lastCheckedAt) : "判定前",
    },
    {
      label: "前回から対象になった件数",
      value: hasAnyData ? displayCount(tv?.becameActiveCount ?? 0) : "判定前",
    },
    {
      label: "前回から対象外になった件数",
      value: hasAnyData
        ? displayCount(tv?.becameUnavailableCount ?? 0)
        : "判定前",
    },
    {
      label: "エラー件数",
      value: hasAnyData ? displayCount(tv?.errorCount ?? 0) : "判定前",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
        <p className="font-bold">FANZA TV見放題管理（準備中）</p>
        <p className="mt-1 leading-relaxed">
          FANZA
          TVの公式見放題APIはないため、判定はMac上のPlaywrightで実行し、結果のみSupabaseへ保存します。Vercel上では大量判定を行いません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-white px-2.5 py-2"
          >
            <p className="text-[10px] text-muted">{c.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums leading-tight">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <p className="text-sm font-bold">操作（将来用）</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {FUTURE_ACTIONS.map((label) => (
            <div key={label}>
              <button
                type="button"
                disabled
                className="min-h-[40px] w-full rounded-lg border border-border bg-zinc-100 text-sm font-semibold text-zinc-500"
              >
                {label}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-amber-800">
          Playwright判定機能の実装後に利用可能
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        <p className="text-sm font-bold">Mac実行コマンド（将来用）</p>
        <p className="text-xs text-muted">
          実装後にここに実際のコマンドを表示します。現時点の関連スクリプト:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 px-3 py-2 text-[11px] text-zinc-100">
          {`# 実装後に表示
# 例: npm run fanza-tv:check -- --limit=100 --concurrency=3

# 現状の関連コマンド（収集→取り込み）
npm run fanza-tv:collect
npm run fanza-tv:ingest`}
        </pre>
        <p className="text-[11px] text-muted">
          ※ <code>fanza-tv:check</code>{" "}
          は未実装のため「実装後に表示」とします。
        </p>
      </div>
    </section>
  );
}
