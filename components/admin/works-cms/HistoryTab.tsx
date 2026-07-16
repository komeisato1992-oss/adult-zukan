"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WorksMasterMigrationPanel } from "@/components/admin/WorksMasterMigrationPanel";
import {
  formatDateTime,
  formatDuration,
} from "@/components/admin/works-cms/format";
import type {
  LiveInitJob,
  SyncHistoryEntry,
  SyncJob,
  WorksCmsOverview,
} from "@/components/admin/works-cms/types";
import { getAdultSyncModeLabel, type AdultSyncMode } from "@/lib/dmm/sync-mode";

type HistoryRow = {
  id: string;
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  targetCount: number | null;
  success: number | null;
  updated: number | null;
  unchanged: number | null;
  duplicate: number | null;
  failed: number | null;
  durationMs: number | null;
  status: string;
  resumeCursor: string | null;
  errorSummary: string | null;
  canResume: boolean;
};

type HistoryTabProps = {
  overview: WorksCmsOverview | null;
  syncJob: SyncJob | null;
  syncHistory: SyncHistoryEntry[];
  liveInitJob: LiveInitJob | null;
  onResumeSync: () => void;
  busy: boolean;
};

function modeLabel(mode?: string): string {
  if (!mode) return "掲載情報更新";
  if (
    mode === "price" ||
    mode === "review" ||
    mode === "rank" ||
    mode === "date" ||
    mode === "availability" ||
    mode === "light" ||
    mode === "full" ||
    mode === "date_rank"
  ) {
    return getAdultSyncModeLabel(mode as AdultSyncMode);
  }
  return mode;
}

export function WorksCmsHistoryTab({
  overview,
  syncJob,
  syncHistory,
  liveInitJob,
  onResumeSync,
  busy,
}: HistoryTabProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list: HistoryRow[] = [];

    if (syncJob) {
      const started = syncJob.startedAt ? Date.parse(syncJob.startedAt) : NaN;
      const ended = syncJob.completedAt
        ? Date.parse(syncJob.completedAt)
        : syncJob.updatedAt
          ? Date.parse(syncJob.updatedAt)
          : NaN;
      list.push({
        id: `current-${syncJob.startedAt ?? "job"}`,
        name: `掲載更新（${modeLabel(syncJob.mode)}）`,
        startedAt: syncJob.startedAt ?? null,
        endedAt: syncJob.completedAt ?? null,
        targetCount: syncJob.targetCount,
        success: syncJob.successCount,
        updated: syncJob.updatedCount,
        unchanged: syncJob.unchangedCount ?? null,
        duplicate: null,
        failed: syncJob.errorCount,
        durationMs:
          Number.isFinite(started) && Number.isFinite(ended)
            ? Math.max(0, ended - started)
            : null,
        status: syncJob.status,
        resumeCursor: syncJob.lastProcessedContentId ?? String(syncJob.cursor ?? ""),
        errorSummary: syncJob.message ?? null,
        canResume:
          syncJob.status === "partial_failed" ||
          syncJob.status === "failed" ||
          Boolean(syncJob.cursor),
      });
    }

    for (const h of syncHistory) {
      const started = Date.parse(h.startedAt);
      const ended = h.completedAt ? Date.parse(h.completedAt) : NaN;
      list.push({
        id: h.jobId,
        name: `掲載更新（${modeLabel(h.mode)}）`,
        startedAt: h.startedAt,
        endedAt: h.completedAt,
        targetCount: h.targetCount,
        success: h.successCount,
        updated: h.updatedCount,
        unchanged: null,
        duplicate: null,
        failed: h.errorCount,
        durationMs:
          Number.isFinite(started) && Number.isFinite(ended)
            ? Math.max(0, ended - started)
            : null,
        status: h.status,
        resumeCursor: null,
        errorSummary: null,
        canResume: false,
      });
    }

    if (liveInitJob) {
      list.push({
        id: `init-${liveInitJob.jobId}`,
        name: "変動情報初期化",
        startedAt: liveInitJob.startedAt,
        endedAt: liveInitJob.completedAt ?? null,
        targetCount: liveInitJob.missingAtStart,
        success: liveInitJob.insertedCount,
        updated: liveInitJob.insertedCount,
        unchanged: null,
        duplicate: null,
        failed: liveInitJob.failedCount,
        durationMs: null,
        status: liveInitJob.status,
        resumeCursor: null,
        errorSummary: liveInitJob.message,
        canResume:
          liveInitJob.status === "stopped" || liveInitJob.status === "failed",
      });
    }

    list.push({
      id: "fanza-tv-future",
      name: "FANZA TV判定",
      startedAt: overview?.fanzaTv.lastCheckedAt ?? null,
      endedAt: overview?.fanzaTv.lastCheckedAt ?? null,
      targetCount: null,
      success: overview?.fanzaTv.activeCount ?? null,
      updated: overview?.fanzaTv.becameActiveCount ?? null,
      unchanged: null,
      duplicate: null,
      failed: overview?.fanzaTv.errorCount ?? null,
      durationMs: null,
      status: "準備中",
      resumeCursor: String(overview?.fanzaTv.resumeCursor ?? ""),
      errorSummary: "Playwright判定機能の実装後に履歴が記録されます",
      canResume: false,
    });

    list.push({
      id: "import-placeholder",
      name: "作品候補取得 / 作品追加",
      startedAt: overview?.lastWorkAddedAt ?? null,
      endedAt: overview?.lastWorkAddedAt ?? null,
      targetCount: null,
      success: null,
      updated: null,
      unchanged: null,
      duplicate: null,
      failed: null,
      durationMs: null,
      status: overview?.lastWorkAddedAt ? "完了" : "未実行",
      resumeCursor: null,
      errorSummary: "候補取得・追加の詳細ログは実行時メッセージに表示されます",
      canResume: false,
    });

    return list;
  }, [syncJob, syncHistory, liveInitJob, overview]);

  const visible = expanded ? rows : rows.slice(0, 5);

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">
        作品候補取得・追加・価格/評価/順位/販売状況更新・変動情報初期化・既存作品移行・将来のFANZA
        TV判定を同じ画面で確認します。
      </p>

      <ul className="space-y-1.5">
        {visible.map((row) => {
          const open = detailId === row.id;
          return (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-white p-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{row.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDateTime(row.startedAt)} →{" "}
                    {formatDateTime(row.endedAt)} · {row.status}
                  </p>
                  <p className="text-[11px] text-muted">
                    対象 {row.targetCount ?? "—"} / 成功 {row.success ?? "—"} /
                    更新 {row.updated ?? "—"} / 失敗 {row.failed ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-sky-700 underline"
                  onClick={() => setDetailId(open ? null : row.id)}
                >
                  {open ? "閉じる" : "詳細"}
                </button>
              </div>
              {open ? (
                <div className="mt-2 space-y-1 rounded-lg bg-zinc-50 px-2 py-2 text-[11px]">
                  <p>変更なし: {row.unchanged ?? "—"}</p>
                  <p>重複: {row.duplicate ?? "—"}</p>
                  <p>実行時間: {formatDuration(row.durationMs)}</p>
                  <p>再開位置: {row.resumeCursor || "—"}</p>
                  <p>エラー概要: {row.errorSummary || "—"}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={!row.canResume || busy}
                      onClick={onResumeSync}
                      className="min-h-[32px] rounded-lg border px-2 font-semibold disabled:opacity-40"
                    >
                      再開
                    </button>
                    <button
                      type="button"
                      disabled
                      className="min-h-[32px] rounded-lg border px-2 font-semibold opacity-40"
                      title="将来対応"
                    >
                      失敗分だけ再実行
                    </button>
                    <button
                      type="button"
                      disabled
                      className="min-h-[32px] rounded-lg border px-2 font-semibold opacity-40"
                    >
                      ログ表示
                    </button>
                    <a
                      href="/api/admin/works-master-migration/errors"
                      className="inline-flex min-h-[32px] items-center rounded-lg border px-2 font-semibold"
                    >
                      エラーCSV
                    </a>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rows.length > 5 ? (
        <button
          type="button"
          className="text-sm text-sky-700 underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "直近5件に戻す" : "すべて見る"}
        </button>
      ) : null}

      <details className="rounded-xl border border-border bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold">
          既存作品移行
        </summary>
        <div className="mt-2">
          <WorksMasterMigrationPanel />
        </div>
      </details>

      <p className="text-[11px] text-muted">
        コード変更時の本番反映は{" "}
        <Link href="/admin/deploy" className="underline">
          デプロイ専用ページ
        </Link>
        または設定へ分離済みです。作品データ操作ではデプロイしません。
      </p>
    </section>
  );
}
