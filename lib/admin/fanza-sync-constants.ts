export const FANZA_SYNC_JOB_RELATIVE_PATH = "data/dmm/fanza-sync-job.json";
export const FANZA_SYNC_HISTORY_RELATIVE_PATH = "data/dmm/fanza-sync-history.json";

export const FANZA_SYNC_DEFAULT_BATCH_SIZE = Number(
  process.env.FANZA_SYNC_BATCH_SIZE ?? 100,
);
export const FANZA_SYNC_DEFAULT_CONCURRENCY = Number(
  process.env.FANZA_SYNC_CONCURRENCY ?? 3,
);
export const FANZA_SYNC_MAX_BATCH_SIZE = 1000;
export const FANZA_SYNC_JOB_STALE_MS = 15 * 60 * 1000;
export const FANZA_SYNC_COMMIT_MAX_RETRIES = 2;
export const FANZA_SYNC_HISTORY_LIMIT = 50;
