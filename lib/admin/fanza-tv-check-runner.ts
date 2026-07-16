import "server-only";

import { spawn } from "child_process";
import { existsSync, mkdirSync, openSync } from "fs";
import path from "path";
import {
  getFanzaTvCheckStats,
  listFanzaTvTargetCids,
} from "@/lib/admin/fanza-tv-check-db";
import {
  loadFanzaTvCheckSnapshot,
  persistFanzaTvCheckSnapshot,
  updateFanzaTvCheckJob,
} from "@/lib/admin/fanza-tv-check-store";
import type {
  FanzaTvCheckJob,
  FanzaTvCheckLimit,
  FanzaTvCheckMode,
} from "@/lib/admin/fanza-tv-check-types";
import {
  FANZA_TV_CHECK_BATCH_SIZE,
  FANZA_TV_CHECK_STALE_MS,
  FANZA_TV_PROFILE_DIR_RELATIVE,
  FANZA_TV_STORAGE_STATE_RELATIVE,
} from "@/lib/admin/fanza-tv-check-types";
import { isVercelRuntime } from "@/lib/admin/runtime-fs";

export class FanzaTvCheckError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FanzaTvCheckError";
    this.status = status;
  }
}

function createJobId(): string {
  return `fanza-tv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActive(job: FanzaTvCheckJob | null): boolean {
  return job?.status === "running" || job?.status === "pending";
}

function isStale(job: FanzaTvCheckJob, now = Date.now()): boolean {
  if (!isActive(job)) return false;
  const updatedAt = Date.parse(job.updatedAt);
  return (
    !Number.isFinite(updatedAt) || now - updatedAt >= FANZA_TV_CHECK_STALE_MS
  );
}

function resolveProfilePath(): {
  kind: "storageState" | "userDataDir" | null;
  path: string | null;
  message: string | null;
} {
  const profileDir = path.join(process.cwd(), FANZA_TV_PROFILE_DIR_RELATIVE);
  const statePath = path.join(process.cwd(), FANZA_TV_STORAGE_STATE_RELATIVE);
  if (existsSync(profileDir)) {
    return { kind: "userDataDir", path: profileDir, message: null };
  }
  if (existsSync(statePath)) {
    return { kind: "storageState", path: statePath, message: null };
  }
  return {
    kind: null,
    path: null,
    message: `Playwright プロファイルがありません。先に npm run fanza-tv:save-profile を実行するか、${FANZA_TV_STORAGE_STATE_RELATIVE} を配置してください`,
  };
}

function resolveLimit(
  mode: FanzaTvCheckMode,
  limit: FanzaTvCheckLimit | null | undefined,
): number | null {
  if (mode === "limit") {
    if (limit === "all" || limit == null) return null;
    return limit;
  }
  return null;
}

function spawnWorker(jobId: string): { pid: number; logPath: string } {
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "run-fanza-tv-check.mjs",
  );
  if (!existsSync(scriptPath)) {
    throw new FanzaTvCheckError(`ワーカースクリプトがありません: ${scriptPath}`);
  }

  const logDir = path.join(process.cwd(), "reports", "fanza-tv-check");
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${jobId}.log`);
  const logFd = openSync(logPath, "a");

  const child = spawn(process.execPath, [scriptPath, "--job", jobId], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      FANZA_TV_CHECK_JOB_ID: jobId,
    },
  });

  if (!child.pid) {
    throw new FanzaTvCheckError("Playwright ワーカーの起動に失敗しました", 500);
  }

  child.unref();
  return { pid: child.pid, logPath };
}

export function fanzaTvCheckProgressPercent(job: FanzaTvCheckJob): number {
  if (job.targetCount <= 0) return 0;
  return Math.min(
    100,
    Math.round((job.processedCount / job.targetCount) * 100),
  );
}

export async function getFanzaTvCheckStatus() {
  const snapshot = loadFanzaTvCheckSnapshot();
  let job = snapshot.currentJob;
  if (job && isActive(job) && isStale(job)) {
    job =
      updateFanzaTvCheckJob((current) => ({
        ...current,
        status: "stopped",
        stopRequested: true,
        message: "更新が止まったため停止扱いにしました（途中再開できます）",
        lastError: "stale job",
      })) ?? job;
  }

  const stats = await getFanzaTvCheckStats();
  const onVercel = isVercelRuntime();
  const profile = onVercel
    ? {
        kind: null as null,
        path: null,
        message:
          "見放題判定はMac上で実行します。本番管理画面では結果と進捗のみ確認できます。",
      }
    : resolveProfilePath();

  return {
    currentJob: onVercel ? null : job,
    progressPercent:
      !onVercel && job ? fanzaTvCheckProgressPercent(job) : 0,
    stats,
    profileReady: onVercel ? false : Boolean(profile.kind),
    profilePath: profile.path,
    profileKind: profile.kind,
    profileMessage: profile.message,
    localOnly: !onVercel,
    canRunPlaywright: !onVercel,
  };
}

export async function startFanzaTvCheckJob(input: {
  mode: FanzaTvCheckMode;
  limit?: FanzaTvCheckLimit | null;
}): Promise<{ job: FanzaTvCheckJob; alreadyRunning: boolean }> {
  if (isVercelRuntime()) {
    throw new FanzaTvCheckError(
      "FANZA TV判定はMacローカル専用です（Vercelでは実行できません）",
      403,
    );
  }

  const snapshot = loadFanzaTvCheckSnapshot();
  const current = snapshot.currentJob;
  if (current && isActive(current) && !isStale(current)) {
    return { job: current, alreadyRunning: true };
  }

  const profile = resolveProfilePath();
  if (!profile.kind || !profile.path) {
    throw new FanzaTvCheckError(profile.message || "プロファイルがありません");
  }

  const { assertWorksFanzaTvSchema } = await import(
    "@/lib/admin/fanza-tv-check-db"
  );
  await assertWorksFanzaTvSchema();

  const numericLimit = resolveLimit(input.mode, input.limit ?? null);
  // ①未確認のみ ②全件再判定 ③指定件数（未確認を優先、足りなければ全件から）
  let cids: string[];
  if (input.mode === "full_recheck") {
    cids = await listFanzaTvTargetCids({
      mode: "full_recheck",
      limit: null,
    });
  } else if (input.mode === "unchecked_only") {
    cids = await listFanzaTvTargetCids({
      mode: "unchecked_only",
      limit: null,
    });
  } else {
    const unchecked = await listFanzaTvTargetCids({
      mode: "unchecked_only",
      limit: numericLimit,
    });
    cids =
      unchecked.length > 0 || numericLimit == null
        ? unchecked
        : await listFanzaTvTargetCids({
            mode: "full_recheck",
            limit: numericLimit,
          });
  }

  const now = new Date().toISOString();
  if (cids.length === 0) {
    const done: FanzaTvCheckJob = {
      jobId: createJobId(),
      status: "completed",
      mode: input.mode,
      limit: input.limit ?? null,
      targetCount: 0,
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      availableCount: 0,
      unavailableCount: 0,
      pendingCids: [],
      currentCid: null,
      batchSize: FANZA_TV_CHECK_BATCH_SIZE,
      startedAt: now,
      updatedAt: now,
      completedAt: now,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      stopRequested: false,
      pid: null,
      message: "判定対象の作品がありません",
      lastError: null,
      profilePath: profile.path,
      logPath: null,
    };
    persistFanzaTvCheckSnapshot({ currentJob: done });
    return { job: done, alreadyRunning: false };
  }

  const jobId = createJobId();
  const job: FanzaTvCheckJob = {
    jobId,
    status: "pending",
    mode: input.mode,
    limit: input.limit ?? null,
    targetCount: cids.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    availableCount: 0,
    unavailableCount: 0,
    pendingCids: cids,
    currentCid: null,
    batchSize: FANZA_TV_CHECK_BATCH_SIZE,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    elapsedMs: 0,
    estimatedRemainingMs: null,
    stopRequested: false,
    pid: null,
    message: "Playwright ワーカーを起動しています…",
    lastError: null,
    profilePath: profile.path,
    logPath: null,
  };
  persistFanzaTvCheckSnapshot({ currentJob: job });

  const { pid, logPath } = spawnWorker(jobId);
  const started =
    updateFanzaTvCheckJob((currentJob) => ({
      ...currentJob,
      status: "running",
      pid,
      logPath,
      message: `判定開始（対象 ${cids.length.toLocaleString()} 件）`,
    })) ?? job;

  return { job: started, alreadyRunning: false };
}

export async function stopFanzaTvCheckJob(): Promise<FanzaTvCheckJob> {
  const snapshot = loadFanzaTvCheckSnapshot();
  const job = snapshot.currentJob;
  if (!job) {
    throw new FanzaTvCheckError("実行中のジョブがありません");
  }
  if (job.status === "completed" || job.status === "failed") {
    return job;
  }

  const next =
    updateFanzaTvCheckJob((current) => ({
      ...current,
      stopRequested: true,
      status: "stopped",
      message: "停止リクエストを受け付けました（現在の作品の後で停止します）",
    })) ?? job;

  return next;
}

export async function resumeFanzaTvCheckJob(): Promise<{
  job: FanzaTvCheckJob;
  alreadyRunning: boolean;
}> {
  if (isVercelRuntime()) {
    throw new FanzaTvCheckError(
      "FANZA TV判定はMacローカル専用です（Vercelでは実行できません）",
      403,
    );
  }

  const snapshot = loadFanzaTvCheckSnapshot();
  const job = snapshot.currentJob;
  if (!job) {
    throw new FanzaTvCheckError("再開できるジョブがありません");
  }
  if (isActive(job) && !isStale(job)) {
    return { job, alreadyRunning: true };
  }
  if (job.pendingCids.length === 0) {
    throw new FanzaTvCheckError("残り対象がありません。新規開始してください");
  }

  const profile = resolveProfilePath();
  if (!profile.kind || !profile.path) {
    throw new FanzaTvCheckError(profile.message || "プロファイルがありません");
  }

  persistFanzaTvCheckSnapshot({
    currentJob: {
      ...job,
      status: "pending",
      stopRequested: false,
      profilePath: profile.path,
      message: "途中再開の準備中…",
      updatedAt: new Date().toISOString(),
      completedAt: null,
      lastError: null,
    },
  });

  const { pid, logPath } = spawnWorker(job.jobId);
  const resumed =
    updateFanzaTvCheckJob((current) => ({
      ...current,
      status: "running",
      pid,
      logPath,
      message: `途中再開（残り ${current.pendingCids.length.toLocaleString()} 件）`,
    })) ?? job;

  return { job: resumed, alreadyRunning: false };
}
