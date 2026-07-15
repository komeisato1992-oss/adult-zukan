export const WORKS_MASTER_MIGRATION_JOB_RELATIVE_PATH =
  "data/dmm/works-master-migration-job.json";

export const WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE = 100;

export type WorksMasterMigrationStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "stopped";

export type WorksMasterMigrationBatchLog = {
  batchIndex: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  processed: number;
  added: number;
  updated: number;
  duplicates: number;
  failed: number;
  lastCid: string | null;
  error: string | null;
};

export type WorksMasterMigrationError = {
  cid: string;
  batchIndex: number;
  message: string;
  at: string;
  code?: string;
};

export type WorksMasterMigrationJob = {
  jobId: string;
  status: WorksMasterMigrationStatus;
  batchSize: number;
  /** ユニークCID配列上の次の開始インデックス */
  cursor: number;
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
  supabaseCountBefore: number;
  supabaseOverlapBefore: number;
  targetCount: number;
  processedCount: number;
  addedCount: number;
  updatedCount: number;
  /** ソースJSON内のCID重複（開始時に確定）＋バッチ内スキップ */
  duplicateCount: number;
  failedCount: number;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  lastProcessedCid: string | null;
  stopReason: string | null;
  message: string | null;
  batchLogs: WorksMasterMigrationBatchLog[];
  errors: WorksMasterMigrationError[];
  totalDurationMs: number;
  estimatedRemainingMs: number | null;
  supabaseCountAfter: number | null;
};

export type WorksMasterMigrationStatusPayload = {
  job: WorksMasterMigrationJob | null;
  remainingCount: number;
  progressPercent: number;
  estimatedRemainingMs: number | null;
  jsonKeptAsFallback: true;
  deployRequired: false;
  gitWrite: false;
};
