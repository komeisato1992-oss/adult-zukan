import "server-only";

export type LiveStatusInitJobStatus =
  | "pending"
  | "running"
  | "waiting"
  | "stopped"
  | "completed"
  | "failed";

export type LiveStatusInitJob = {
  jobId: string;
  status: LiveStatusInitJobStatus;
  batchSize: number;
  worksCount: number;
  liveStatusCount: number;
  missingAtStart: number;
  insertedCount: number;
  failedCount: number;
  remainingCount: number;
  batchesCompleted: number;
  /** 未処理の未初期化 CID（途中経過） */
  pendingCids: string[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** 429 など待機解除時刻 */
  waitUntil: string | null;
  message: string;
  lastError: string | null;
};

export type LiveStatusInitSnapshot = {
  currentJob: LiveStatusInitJob | null;
};

export const LIVE_STATUS_INIT_JOB_RELATIVE_PATH =
  "data/dmm/live-status-init-job.json";

export const LIVE_STATUS_INIT_BATCH_SIZE = 100;
export const LIVE_STATUS_INIT_STALE_MS = 10 * 60 * 1000;
export const LIVE_STATUS_INIT_429_WAIT_MS = 15_000;
