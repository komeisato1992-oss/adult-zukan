import "server-only";

export type FanzaTvCheckStatus =
  | "unknown"
  | "available"
  | "unavailable";

export type FanzaTvCheckJobStatus =
  | "pending"
  | "running"
  | "stopped"
  | "completed"
  | "failed";

export type FanzaTvCheckMode =
  | "unchecked_only"
  | "full_recheck"
  | "limit";

export type FanzaTvCheckLimit = 100 | 500 | 1000 | "all";

export type FanzaTvCheckJob = {
  jobId: string;
  status: FanzaTvCheckJobStatus;
  mode: FanzaTvCheckMode;
  limit: FanzaTvCheckLimit | null;
  targetCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  availableCount: number;
  unavailableCount: number;
  pendingCids: string[];
  currentCid: string | null;
  batchSize: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  stopRequested: boolean;
  pid: number | null;
  message: string;
  lastError: string | null;
  profilePath: string | null;
  logPath: string | null;
};

export type FanzaTvCheckSnapshot = {
  currentJob: FanzaTvCheckJob | null;
};

export type FanzaTvCheckStats = {
  totalCount: number;
  availableCount: number;
  unavailableCount: number;
  uncheckedCount: number;
  lastCheckedAt: string | null;
  schemaReady: boolean;
};

export const FANZA_TV_CHECK_JOB_RELATIVE_PATH =
  "data/dmm/fanza-tv-check-job.json";

export const FANZA_TV_CHECK_BATCH_SIZE = 100;
export const FANZA_TV_CHECK_MAX_RETRIES = 3;
export const FANZA_TV_CHECK_STALE_MS = 15 * 60 * 1000;

export const FANZA_TV_STORAGE_STATE_RELATIVE =
  ".playwright/fanza-tv-storage-state.json";
export const FANZA_TV_PROFILE_DIR_RELATIVE = ".playwright/fanza-tv-profile";
