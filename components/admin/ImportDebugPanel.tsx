"use client";

import type { ImportBatchJob } from "@/lib/admin/import-batch-job";
import type { ImportSelectionState } from "@/lib/admin/import-selection";

type ImportDebugPanelProps = {
  job: ImportBatchJob | null;
  serverInProgress: boolean;
  currentOffsetInput: string;
  persistedPastOffset: number;
  persistedNextPastOffset: number;
  persistedPopularOffset: number;
  candidateTotalCount: number;
  visibleCount: number;
  filteredTotalCount: number;
  selection: ImportSelectionState;
  selectedCount: number;
};

export function ImportDebugPanel({
  job,
  serverInProgress,
  currentOffsetInput,
  persistedPastOffset,
  persistedNextPastOffset,
  persistedPopularOffset,
  candidateTotalCount,
  visibleCount,
  filteredTotalCount,
  selection,
  selectedCount,
}: ImportDebugPanelProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/70 p-4 text-xs text-violet-950">
      <p className="font-bold">開発用デバッグ情報</p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        <div>activeJobId: {job?.activeJobId ?? "null"}</div>
        <div>activeJobStatus: {job?.status ?? "—"}</div>
        <div>activeJobUpdatedAt: {job?.updatedAt ?? "—"}</div>
        <div>lock状態: {serverInProgress ? "locked" : "unlocked"}</div>
        <div>currentOffset入力: {currentOffsetInput || "(空=サーバー値)"}</div>
        <div>persistedPastOffset: {persistedPastOffset.toLocaleString()}</div>
        <div>persistedNextPastOffset: {persistedNextPastOffset.toLocaleString()}</div>
        <div>persistedPopularOffset: {persistedPopularOffset.toLocaleString()}</div>
        <div>candidateTotalCount: {candidateTotalCount.toLocaleString()}</div>
        <div>visibleCount: {visibleCount.toLocaleString()}</div>
        <div>filteredTotalCount: {filteredTotalCount.toLocaleString()}</div>
        <div>selectionMode: {selection.mode}</div>
        <div>selectedCount: {selectedCount.toLocaleString()}</div>
        <div>processId: {job?.processId || "—"}</div>
        <div>idempotencyKey: {job?.idempotencyKey || "—"}</div>
      </dl>
    </div>
  );
}
