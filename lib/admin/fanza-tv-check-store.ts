import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  FanzaTvCheckJob,
  FanzaTvCheckJobStatus,
  FanzaTvCheckLimit,
  FanzaTvCheckMode,
  FanzaTvCheckSnapshot,
} from "@/lib/admin/fanza-tv-check-types";
import { FANZA_TV_CHECK_JOB_RELATIVE_PATH } from "@/lib/admin/fanza-tv-check-types";

type MemoryHolder = typeof globalThis & {
  __fanzaTvCheckSnapshot?: FanzaTvCheckSnapshot;
};

function absolutePath(): string {
  return path.join(process.cwd(), FANZA_TV_CHECK_JOB_RELATIVE_PATH);
}

function emptySnapshot(): FanzaTvCheckSnapshot {
  return { currentJob: null };
}

function isValidStatus(value: unknown): value is FanzaTvCheckJobStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "stopped" ||
    value === "completed" ||
    value === "failed"
  );
}

function isValidMode(value: unknown): value is FanzaTvCheckMode {
  return (
    value === "unchecked_only" ||
    value === "full_recheck" ||
    value === "limit"
  );
}

function parseLimit(value: unknown): FanzaTvCheckLimit | null {
  if (value === "all" || value === 100 || value === 500 || value === 1000) {
    return value;
  }
  if (value === "100") return 100;
  if (value === "500") return 500;
  if (value === "1000") return 1000;
  return null;
}

function parseJob(raw: unknown): FanzaTvCheckJob | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<FanzaTvCheckJob>;
  if (!value.jobId || !value.startedAt || !isValidStatus(value.status)) {
    return null;
  }
  if (!isValidMode(value.mode)) return null;
  return {
    jobId: String(value.jobId),
    status: value.status,
    mode: value.mode,
    limit: parseLimit(value.limit),
    targetCount: Number(value.targetCount ?? 0) || 0,
    processedCount: Number(value.processedCount ?? 0) || 0,
    successCount: Number(value.successCount ?? 0) || 0,
    failedCount: Number(value.failedCount ?? 0) || 0,
    availableCount: Number(value.availableCount ?? 0) || 0,
    unavailableCount: Number(value.unavailableCount ?? 0) || 0,
    pendingCids: Array.isArray(value.pendingCids)
      ? value.pendingCids.map((cid) => String(cid)).filter(Boolean)
      : [],
    currentCid: value.currentCid == null ? null : String(value.currentCid),
    batchSize: Number(value.batchSize ?? 100) || 100,
    startedAt: String(value.startedAt),
    updatedAt: String(value.updatedAt ?? value.startedAt),
    completedAt:
      value.completedAt == null ? null : String(value.completedAt),
    elapsedMs: Number(value.elapsedMs ?? 0) || 0,
    estimatedRemainingMs:
      value.estimatedRemainingMs == null
        ? null
        : Number(value.estimatedRemainingMs),
    stopRequested: Boolean(value.stopRequested),
    pid: value.pid == null ? null : Number(value.pid),
    message: String(value.message ?? ""),
    lastError: value.lastError == null ? null : String(value.lastError),
    profilePath:
      value.profilePath == null ? null : String(value.profilePath),
    logPath: value.logPath == null ? null : String(value.logPath),
  };
}

function readFromDisk(): FanzaTvCheckSnapshot {
  const filePath = absolutePath();
  if (!existsSync(filePath)) return emptySnapshot();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
      currentJob?: unknown;
    };
    return { currentJob: parseJob(raw.currentJob) };
  } catch {
    return emptySnapshot();
  }
}

/** ローカルのみ保存。Git / デプロイはしない */
export function loadFanzaTvCheckSnapshot(): FanzaTvCheckSnapshot {
  const memory = globalThis as MemoryHolder;
  const disk = readFromDisk();
  const mem = memory.__fanzaTvCheckSnapshot;
  if (!mem?.currentJob) {
    memory.__fanzaTvCheckSnapshot = disk;
    return disk;
  }
  // ディスクの更新が新しければ優先（detached worker 更新を拾う）
  const memUpdated = Date.parse(mem.currentJob.updatedAt || "") || 0;
  const diskUpdated = Date.parse(disk.currentJob?.updatedAt || "") || 0;
  if (disk.currentJob && diskUpdated >= memUpdated) {
    memory.__fanzaTvCheckSnapshot = disk;
    return disk;
  }
  return mem;
}

export function persistFanzaTvCheckSnapshot(
  snapshot: FanzaTvCheckSnapshot,
): void {
  const memory = globalThis as MemoryHolder;
  memory.__fanzaTvCheckSnapshot = snapshot;
  const filePath = absolutePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({ currentJob: snapshot.currentJob }, null, 2)}\n`,
    "utf8",
  );
}

export function updateFanzaTvCheckJob(
  mutator: (job: FanzaTvCheckJob) => FanzaTvCheckJob,
): FanzaTvCheckJob | null {
  const snapshot = loadFanzaTvCheckSnapshot();
  if (!snapshot.currentJob) return null;
  const next = mutator(snapshot.currentJob);
  next.updatedAt = new Date().toISOString();
  persistFanzaTvCheckSnapshot({ currentJob: next });
  return next;
}
