export const FANZA_SYNC_JOB_RELATIVE_PATH = "data/dmm/fanza-sync-job.json";
export const FANZA_SYNC_HISTORY_RELATIVE_PATH = "data/dmm/fanza-sync-history.json";

export const FANZA_SYNC_DEFAULT_BATCH_SIZE = Number(
  process.env.FANZA_SYNC_BATCH_SIZE ?? 100,
);
export const FANZA_SYNC_DEFAULT_CONCURRENCY = Number(
  process.env.FANZA_SYNC_CONCURRENCY ?? 3,
);
/** 軽量同期バッチ間の待機（1〜2秒想定） */
export const FANZA_SYNC_BATCH_INTERVAL_MS = Number(
  process.env.FANZA_SYNC_BATCH_INTERVAL_MS ?? 1500,
);
export const FANZA_SYNC_MAX_BATCH_SIZE = 1000;
export const FANZA_SYNC_JOB_STALE_MS = 15 * 60 * 1000;
export const FANZA_SYNC_COMMIT_MAX_RETRIES = 2;
export const FANZA_SYNC_HISTORY_LIMIT = 50;

/** 軽量同期の対象件数上限（0以下は全件。第1段階検証は 100） */
export function getAdultLightSyncTargetLimit(): number {
  const n = Number(process.env.ADULT_LIGHT_SYNC_TARGET_LIMIT ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
