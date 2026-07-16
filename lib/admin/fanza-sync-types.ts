import type { FanzaSyncTargetScope } from "@/lib/admin/fanza-sync-progress";
import type { AdultSyncMode } from "@/lib/dmm/sync-mode";

export type FanzaSyncTrigger = "manual" | "auto";

export type FanzaSyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial_failed"
  | "failed";

export type FanzaSyncJob = {
  jobId: string;
  trigger: FanzaSyncTrigger;
  status: FanzaSyncJobStatus;
  /** light | price | rank | date | full。未設定は full（後方互換） */
  mode?: AdultSyncMode;
  /** 更新対象スコープ（全作品 / image_status未確認） */
  targetScope?: FanzaSyncTargetScope;
  /** 今回ランの開始オフセット（安定順） */
  runStartOffset?: number;
  /** UIで指定した1回の処理件数 */
  runLimit?: number;
  /** スコープ内の対象総数 */
  universeCount?: number;
  targetCount: number;
  processedCount: number;
  successCount: number;
  updatedCount: number;
  unchangedCount: number;
  unconfirmedCount: number;
  hiddenCount: number;
  republishedCount: number;
  errorCount: number;
  /** 安定順リスト上の絶対カーソル */
  cursor: number;
  batchSize: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastProcessedContentId: string | null;
  message: string | null;
  lockOwner: string | null;
};

export type FanzaSyncHistoryEntry = {
  jobId: string;
  trigger: FanzaSyncTrigger;
  startedAt: string;
  completedAt: string | null;
  targetCount: number;
  successCount: number;
  updatedCount: number;
  unconfirmedCount: number;
  hiddenCount: number;
  republishedCount: number;
  errorCount: number;
  status: FanzaSyncJobStatus;
};

export type FanzaSyncJobSnapshot = {
  currentJob: FanzaSyncJob | null;
  history: FanzaSyncHistoryEntry[];
};
