import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  LiveStatusInitJob,
  LiveStatusInitJobStatus,
  LiveStatusInitSnapshot,
} from "@/lib/admin/live-status-init-types";
import { LIVE_STATUS_INIT_JOB_RELATIVE_PATH } from "@/lib/admin/live-status-init-types";

type MemoryHolder = typeof globalThis & {
  __liveStatusInitSnapshot?: LiveStatusInitSnapshot;
};

function absolutePath(): string {
  return path.join(process.cwd(), LIVE_STATUS_INIT_JOB_RELATIVE_PATH);
}

function emptySnapshot(): LiveStatusInitSnapshot {
  return { currentJob: null };
}

function isValidStatus(value: unknown): value is LiveStatusInitJobStatus {
  return (
    value === "pending" ||
    value === "running" ||
    value === "waiting" ||
    value === "stopped" ||
    value === "completed" ||
    value === "failed"
  );
}

function parseJob(raw: unknown): LiveStatusInitJob | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LiveStatusInitJob>;
  if (!value.jobId || !value.startedAt || !isValidStatus(value.status)) {
    return null;
  }
  return {
    jobId: String(value.jobId),
    status: value.status,
    batchSize: Number(value.batchSize ?? 100) || 100,
    worksCount: Number(value.worksCount ?? 0) || 0,
    liveStatusCount: Number(value.liveStatusCount ?? 0) || 0,
    missingAtStart: Number(value.missingAtStart ?? 0) || 0,
    insertedCount: Number(value.insertedCount ?? 0) || 0,
    failedCount: Number(value.failedCount ?? 0) || 0,
    remainingCount: Number(value.remainingCount ?? 0) || 0,
    batchesCompleted: Number(value.batchesCompleted ?? 0) || 0,
    pendingCids: Array.isArray(value.pendingCids)
      ? value.pendingCids.map((cid) => String(cid)).filter(Boolean)
      : [],
    startedAt: String(value.startedAt),
    updatedAt: String(value.updatedAt ?? value.startedAt),
    completedAt:
      value.completedAt == null ? null : String(value.completedAt),
    waitUntil: value.waitUntil == null ? null : String(value.waitUntil),
    message: String(value.message ?? ""),
    lastError: value.lastError == null ? null : String(value.lastError),
  };
}

function readFromDisk(): LiveStatusInitSnapshot {
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
export function loadLiveStatusInitSnapshot(): LiveStatusInitSnapshot {
  const memory = globalThis as MemoryHolder;
  if (memory.__liveStatusInitSnapshot) {
    return memory.__liveStatusInitSnapshot;
  }
  const snapshot = readFromDisk();
  memory.__liveStatusInitSnapshot = snapshot;
  return snapshot;
}

export function persistLiveStatusInitSnapshot(
  snapshot: LiveStatusInitSnapshot,
): void {
  const memory = globalThis as MemoryHolder;
  memory.__liveStatusInitSnapshot = snapshot;
  const filePath = absolutePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({ currentJob: snapshot.currentJob }, null, 2)}\n`,
    "utf8",
  );
}
