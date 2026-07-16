import "server-only";

import {
  loadLiveStatusInitSnapshot,
  persistLiveStatusInitSnapshot,
} from "@/lib/admin/live-status-init-store";
import type { LiveStatusInitJob } from "@/lib/admin/live-status-init-types";
import {
  LIVE_STATUS_INIT_429_WAIT_MS,
  LIVE_STATUS_INIT_BATCH_SIZE,
  LIVE_STATUS_INIT_STALE_MS,
} from "@/lib/admin/live-status-init-types";
import {
  getLiveStatusInitCounts,
  initializeMissingLiveStatusByCids,
} from "@/lib/dmm/work-live-status";

export class LiveStatusInitError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LiveStatusInitError";
    this.status = status;
  }
}

function createJobId(): string {
  return `live-init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActive(job: LiveStatusInitJob | null): boolean {
  return (
    job?.status === "running" ||
    job?.status === "pending" ||
    job?.status === "waiting"
  );
}

function isStale(job: LiveStatusInitJob, now = Date.now()): boolean {
  if (!isActive(job)) return false;
  const updatedAt = Date.parse(job.updatedAt);
  return (
    !Number.isFinite(updatedAt) || now - updatedAt >= LIVE_STATUS_INIT_STALE_MS
  );
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; code?: string; message?: string };
  if (err.status === 429) return true;
  const message = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    code === "429" ||
    code === "over_request_rate_limit"
  );
}

export function liveStatusInitProgressPercent(job: LiveStatusInitJob): number {
  if (job.worksCount <= 0) return 0;
  return Math.min(
    100,
    Math.round((job.liveStatusCount / job.worksCount) * 100),
  );
}

export async function getLiveStatusInitStatus(): Promise<{
  currentJob: LiveStatusInitJob | null;
  progressPercent: number;
  worksCount: number;
  liveStatusCount: number;
  missingCount: number;
  initRatePercent: number;
}> {
  const snapshot = loadLiveStatusInitSnapshot();
  const job = snapshot.currentJob;
  let worksCount = job?.worksCount ?? 0;
  let liveStatusCount = job?.liveStatusCount ?? 0;
  let missingCount = job?.remainingCount ?? 0;

  try {
    const counts = await getLiveStatusInitCounts();
    worksCount = counts.worksCount;
    liveStatusCount = counts.liveStatusCount;
    missingCount = counts.missingCount;
  } catch {
    // keep job-cached counts
  }

  const initRatePercent =
    worksCount <= 0
      ? 0
      : Math.min(100, Math.round((liveStatusCount / worksCount) * 100));

  return {
    currentJob: job,
    progressPercent: job ? liveStatusInitProgressPercent(job) : initRatePercent,
    worksCount,
    liveStatusCount,
    missingCount,
    initRatePercent,
  };
}

export async function startLiveStatusInitJob(): Promise<{
  job: LiveStatusInitJob;
  alreadyRunning: boolean;
}> {
  const snapshot = loadLiveStatusInitSnapshot();
  const current = snapshot.currentJob;

  if (current && isActive(current) && !isStale(current)) {
    return { job: current, alreadyRunning: true };
  }

  const counts = await getLiveStatusInitCounts();
  const now = new Date().toISOString();

  if (counts.missingCount <= 0) {
    const done: LiveStatusInitJob = {
      jobId: createJobId(),
      status: "completed",
      batchSize: LIVE_STATUS_INIT_BATCH_SIZE,
      worksCount: counts.worksCount,
      liveStatusCount: counts.liveStatusCount,
      missingAtStart: 0,
      insertedCount: 0,
      failedCount: 0,
      remainingCount: 0,
      batchesCompleted: 0,
      pendingCids: [],
      startedAt: now,
      updatedAt: now,
      completedAt: now,
      waitUntil: null,
      message: "未初期化の変動情報はありません",
      lastError: null,
    };
    persistLiveStatusInitSnapshot({ currentJob: done });
    return { job: done, alreadyRunning: false };
  }

  const { getPublishedWorksMasterContentIdSet } = await import(
    "@/lib/dmm/works-master"
  );
  const {
    getConfiguredWorkLiveStatusBackend,
  } = await import("@/lib/dmm/work-live-status/types");
  const backend = getConfiguredWorkLiveStatusBackend();
  const {
    supabaseFetchAllLiveStatusCids,
  } = await import("@/lib/dmm/work-live-status/supabase-store");
  const {
    localFetchAllLiveStatusCids,
  } = await import("@/lib/dmm/work-live-status/local-store");

  const published = [...(await getPublishedWorksMasterContentIdSet())];
  const existing = new Set(
    backend === "supabase"
      ? await supabaseFetchAllLiveStatusCids()
      : await localFetchAllLiveStatusCids(),
  );
  const pendingCids = published.filter((cid) => !existing.has(cid));

  const job: LiveStatusInitJob = {
    jobId: createJobId(),
    status: "running",
    batchSize: LIVE_STATUS_INIT_BATCH_SIZE,
    worksCount: counts.worksCount,
    liveStatusCount: counts.liveStatusCount,
    missingAtStart: pendingCids.length,
    insertedCount: 0,
    failedCount: 0,
    remainingCount: pendingCids.length,
    batchesCompleted: 0,
    pendingCids,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    waitUntil: null,
    message: `変動情報の初期化を開始（残り ${pendingCids.length.toLocaleString()} 件）`,
    lastError: null,
  };

  persistLiveStatusInitSnapshot({ currentJob: job });
  return { job, alreadyRunning: false };
}

export async function stopLiveStatusInitJob(): Promise<LiveStatusInitJob> {
  const snapshot = loadLiveStatusInitSnapshot();
  const current = snapshot.currentJob;
  if (!current) {
    throw new LiveStatusInitError("停止できる初期化ジョブがありません。", 404);
  }
  if (current.status === "completed") {
    return current;
  }

  const now = new Date().toISOString();
  const stopped: LiveStatusInitJob = {
    ...current,
    status: "stopped",
    updatedAt: now,
    waitUntil: null,
    message: `初期化を停止しました（挿入 ${current.insertedCount.toLocaleString()} / 残り ${current.remainingCount.toLocaleString()}）`,
  };
  persistLiveStatusInitSnapshot({ currentJob: stopped });
  return stopped;
}

export async function resumeLiveStatusInitJob(): Promise<{
  job: LiveStatusInitJob;
  alreadyRunning: boolean;
}> {
  const snapshot = loadLiveStatusInitSnapshot();
  const current = snapshot.currentJob;

  if (!current) {
    return startLiveStatusInitJob();
  }

  if (isActive(current) && !isStale(current)) {
    return { job: current, alreadyRunning: true };
  }

  if (current.status === "completed" && current.remainingCount <= 0) {
    const counts = await getLiveStatusInitCounts();
    if (counts.missingCount <= 0) {
      return { job: current, alreadyRunning: false };
    }
    return startLiveStatusInitJob();
  }

  const counts = await getLiveStatusInitCounts();
  const now = new Date().toISOString();

  let pendingCids = current.pendingCids ?? [];
  if (pendingCids.length === 0 && counts.missingCount > 0) {
    const { getPublishedWorksMasterContentIdSet } = await import(
      "@/lib/dmm/works-master"
    );
    const { getConfiguredWorkLiveStatusBackend } = await import(
      "@/lib/dmm/work-live-status/types"
    );
    const backend = getConfiguredWorkLiveStatusBackend();
    const { supabaseFetchAllLiveStatusCids } = await import(
      "@/lib/dmm/work-live-status/supabase-store"
    );
    const { localFetchAllLiveStatusCids } = await import(
      "@/lib/dmm/work-live-status/local-store"
    );
    const published = [...(await getPublishedWorksMasterContentIdSet())];
    const existing = new Set(
      backend === "supabase"
        ? await supabaseFetchAllLiveStatusCids()
        : await localFetchAllLiveStatusCids(),
    );
    pendingCids = published.filter((cid) => !existing.has(cid));
  }

  const resumed: LiveStatusInitJob = {
    ...current,
    status: "running",
    worksCount: counts.worksCount,
    liveStatusCount: counts.liveStatusCount,
    remainingCount: pendingCids.length,
    pendingCids,
    updatedAt: now,
    completedAt: null,
    waitUntil: null,
    message: `初期化を再開（残り ${pendingCids.length.toLocaleString()} 件）`,
    lastError: null,
  };
  persistLiveStatusInitSnapshot({ currentJob: resumed });
  return { job: resumed, alreadyRunning: false };
}

/**
 * 1バッチ（最大100件）処理。途中経過はローカル保存のみ。
 */
export async function processLiveStatusInitBatch(): Promise<{
  job: LiveStatusInitJob;
  done: boolean;
  waited: boolean;
}> {
  const snapshot = loadLiveStatusInitSnapshot();
  let job = snapshot.currentJob;

  if (!job) {
    throw new LiveStatusInitError("初期化ジョブがありません。", 404);
  }

  if (job.status === "stopped") {
    return { job, done: false, waited: false };
  }

  if (job.status === "completed") {
    return { job, done: true, waited: false };
  }

  if (job.status === "waiting" && job.waitUntil) {
    const waitUntilMs = Date.parse(job.waitUntil);
    if (Number.isFinite(waitUntilMs) && Date.now() < waitUntilMs) {
      return { job, done: false, waited: true };
    }
  }

  const nowIso = new Date().toISOString();
  job = {
    ...job,
    status: "running",
    waitUntil: null,
    updatedAt: nowIso,
    message: `初期化中… ${job.insertedCount.toLocaleString()} / ${job.missingAtStart.toLocaleString()}`,
  };
  persistLiveStatusInitSnapshot({ currentJob: job });

  try {
    const batchSize = job.batchSize || LIVE_STATUS_INIT_BATCH_SIZE;
    const pending = [...(job.pendingCids ?? [])];
    const batchCids = pending.slice(0, batchSize);
    const restCids = pending.slice(batchSize);

    if (batchCids.length === 0) {
      const completed: LiveStatusInitJob = {
        ...job,
        status: "completed",
        remainingCount: 0,
        pendingCids: [],
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        message: `初期化完了（${job.insertedCount.toLocaleString()} 件）`,
      };
      persistLiveStatusInitSnapshot({ currentJob: completed });
      return { job: completed, done: true, waited: false };
    }

    const result = await initializeMissingLiveStatusByCids(batchCids);

    const insertedCount = job.insertedCount + result.inserted;
    const failedCount = job.failedCount + result.failed;
    const batchesCompleted = job.batchesCompleted + 1;
    const remainingCount = restCids.length;
    const liveStatusCount = job.liveStatusCount + result.inserted;
    const done = remainingCount <= 0;

    const next: LiveStatusInitJob = {
      ...job,
      status: done ? "completed" : "running",
      liveStatusCount,
      insertedCount,
      failedCount,
      remainingCount,
      batchesCompleted,
      pendingCids: restCids,
      updatedAt: new Date().toISOString(),
      completedAt: done ? new Date().toISOString() : null,
      waitUntil: null,
      lastError: null,
      message: done
        ? `初期化完了（${insertedCount.toLocaleString()} 件）`
        : `初期化中… ${insertedCount.toLocaleString()} / ${job.missingAtStart.toLocaleString()}（残り ${remainingCount.toLocaleString()}）`,
    };

    persistLiveStatusInitSnapshot({ currentJob: next });
    return { job: next, done, waited: false };
  } catch (error) {
    if (isRateLimitError(error)) {
      const waitUntil = new Date(
        Date.now() + LIVE_STATUS_INIT_429_WAIT_MS,
      ).toISOString();
      const waiting: LiveStatusInitJob = {
        ...job,
        status: "waiting",
        waitUntil,
        updatedAt: new Date().toISOString(),
        lastError: "429 rate limit",
        message: `API制限のため待機中（${LIVE_STATUS_INIT_429_WAIT_MS / 1000}秒）`,
      };
      persistLiveStatusInitSnapshot({ currentJob: waiting });
      return { job: waiting, done: false, waited: true };
    }

    const failed: LiveStatusInitJob = {
      ...job,
      status: "failed",
      failedCount: job.failedCount + 1,
      updatedAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error),
      message: "初期化バッチに失敗しました。再開できます。",
    };
    persistLiveStatusInitSnapshot({ currentJob: failed });
    throw new LiveStatusInitError(
      failed.lastError ?? "初期化に失敗しました",
      500,
    );
  }
}
