"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fanzaSyncStatusLabel,
} from "@/lib/admin/fanza-sync-job";
import type {
  FanzaSyncHistoryEntry,
  FanzaSyncJob,
} from "@/lib/admin/fanza-sync-types";

type FanzaSyncPanelProps = {
  configured: boolean;
  dmmConfigured: boolean;
};

type StatusResponse = {
  success: boolean;
  currentJob: FanzaSyncJob | null;
  history: FanzaSyncHistoryEntry[];
  progressPercent: number;
  alreadyRunning?: boolean;
  message?: string;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function triggerLabel(trigger: FanzaSyncHistoryEntry["trigger"]): string {
  return trigger === "auto" ? "自動" : "手動";
}

export function FanzaSyncPanel({
  configured,
  dmmConfigured,
}: FanzaSyncPanelProps) {
  const [job, setJob] = useState<FanzaSyncJob | null>(null);
  const [history, setHistory] = useState<FanzaSyncHistoryEntry[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-sync/status");
    if (!response.ok) return null;
    const data = (await response.json()) as StatusResponse;
    setJob(data.currentJob);
    setHistory(data.history ?? []);
    setProgressPercent(data.progressPercent ?? 0);
    return data;
  }, []);

  const processNextBatch = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const response = await fetch("/api/admin/fanza-sync/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "同期バッチの処理に失敗しました。");
      }

      setJob(data.job ?? null);
      setProgressPercent(data.progressPercent ?? 0);
      await loadStatus();
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [loadStatus]);

  const runUntilComplete = useCallback(async () => {
    let status = await loadStatus();
    while (
      status?.currentJob &&
      (status.currentJob.status === "running" ||
        status.currentJob.status === "pending")
    ) {
      await processNextBatch();
      status = await loadStatus();
    }
  }, [loadStatus, processNextBatch]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (
      !job ||
      (job.status !== "running" && job.status !== "pending") ||
      isProcessing
    ) {
      return;
    }

    void processNextBatch();
  }, [job, isProcessing, processNextBatch]);

  const isRunning = useMemo(
    () => job?.status === "running" || job?.status === "pending",
    [job],
  );

  const handleStart = async () => {
    setModalOpen(false);
    setError(null);
    setMessage(null);
    setIsStarting(true);

    try {
      const response = await fetch("/api/admin/fanza-sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as StatusResponse;

      if (data.alreadyRunning) {
        setMessage("現在、更新処理を実行中です");
        setJob(data.currentJob);
        setProgressPercent(data.progressPercent ?? 0);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "同期ジョブの開始に失敗しました。");
      }

      setMessage("同期ジョブを開始しました。バックグラウンドで処理します。");
      setJob(data.currentJob);
      setProgressPercent(data.progressPercent ?? 0);
      void runUntilComplete();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "同期ジョブの開始に失敗しました。",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const disabled = !configured || !dmmConfigured || isStarting || isRunning;

  return (
    <section className="rounded-xl border border-sky-300 bg-sky-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            掲載作品を最新に更新
          </h2>
          <p className="mt-2 text-sm text-muted">
            掲載中の全作品について、FANZAの販売情報・価格・セール情報をバックグラウンドで同期します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isRunning ? "更新実行中…" : "掲載作品を最新に更新"}
        </button>
      </div>

      {!configured || !dmmConfigured ? (
        <p className="mt-3 text-sm text-amber-700">
          GitHub または FANZA API の設定が未完了のため、同期を開始できません。
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-foreground">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {job ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">状態</dt>
              <dd>{fanzaSyncStatusLabel(job.status)}</dd>
            </div>
            <div>
              <dt className="text-muted">対象件数</dt>
              <dd>{job.targetCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">処理済み件数</dt>
              <dd>{job.processedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">更新成功件数</dt>
              <dd>{job.successCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">更新件数</dt>
              <dd>{job.updatedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">販売終了候補件数</dt>
              <dd>{job.unconfirmedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">非表示にした件数</dt>
              <dd>{job.hiddenCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">再公開した件数</dt>
              <dd>{job.republishedCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">エラー件数</dt>
              <dd>{job.errorCount.toLocaleString()}件</dd>
            </div>
            <div>
              <dt className="text-muted">開始日時</dt>
              <dd>{formatDateTime(job.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">最終更新日時</dt>
              <dd>{formatDateTime(job.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">進捗率</dt>
              <dd>{progressPercent}%</dd>
            </div>
          </dl>

          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>進捗</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-sky-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-foreground">同期履歴</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="px-2 py-1">実行種別</th>
                  <th className="px-2 py-1">開始</th>
                  <th className="px-2 py-1">終了</th>
                  <th className="px-2 py-1">対象</th>
                  <th className="px-2 py-1">成功</th>
                  <th className="px-2 py-1">更新</th>
                  <th className="px-2 py-1">未確認</th>
                  <th className="px-2 py-1">非表示</th>
                  <th className="px-2 py-1">再公開</th>
                  <th className="px-2 py-1">エラー</th>
                  <th className="px-2 py-1">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.jobId} className="border-t border-border/60">
                    <td className="px-2 py-1">{triggerLabel(entry.trigger)}</td>
                    <td className="px-2 py-1">{formatDateTime(entry.startedAt)}</td>
                    <td className="px-2 py-1">{formatDateTime(entry.completedAt)}</td>
                    <td className="px-2 py-1">{entry.targetCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.successCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.updatedCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.unconfirmedCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.hiddenCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.republishedCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{entry.errorCount.toLocaleString()}</td>
                    <td className="px-2 py-1">{fanzaSyncStatusLabel(entry.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fanza-sync-modal-title"
          >
            <h3
              id="fanza-sync-modal-title"
              className="text-lg font-bold text-foreground"
            >
              掲載作品の同期
            </h3>
            <p className="mt-3 text-sm text-muted">
              掲載中の全作品について、FANZAの販売情報・価格・セール情報を更新します。
              処理はバックグラウンドで実行されます。開始しますか？
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleStart()}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
              >
                更新を開始
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
