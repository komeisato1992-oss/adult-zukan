import type {
  FanzaSyncHistoryEntry,
  FanzaSyncJob,
  FanzaSyncJobSnapshot,
  FanzaSyncJobStatus,
  FanzaSyncTrigger,
} from "@/lib/admin/fanza-sync-types";
import { FANZA_SYNC_DEFAULT_BATCH_SIZE } from "@/lib/admin/fanza-sync-constants";
import type { AdultSyncMode } from "@/lib/dmm/sync-mode";

export function createFanzaSyncJobId(): string {
  return `fanza-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyFanzaSyncSnapshot(): FanzaSyncJobSnapshot {
  return { currentJob: null, history: [] };
}

export function createFanzaSyncJob(input: {
  trigger: FanzaSyncTrigger;
  targetCount: number;
  batchSize?: number;
  mode?: AdultSyncMode;
  targetScope?: FanzaSyncJob["targetScope"];
  runStartOffset?: number;
  runLimit?: number;
  universeCount?: number;
  cursor?: number;
}): FanzaSyncJob {
  const now = new Date().toISOString();
  const jobId = createFanzaSyncJobId();
  const runStartOffset = Math.max(0, Math.floor(input.runStartOffset ?? 0));
  const runLimit = Math.max(1, Math.floor(input.runLimit ?? input.targetCount));
  const universeCount = Math.max(
    0,
    Math.floor(input.universeCount ?? input.targetCount),
  );
  const cursor = Math.max(0, Math.floor(input.cursor ?? runStartOffset));

  return {
    jobId,
    trigger: input.trigger,
    status: "running",
    mode: input.mode ?? "full",
    targetScope: input.targetScope ?? "all",
    runStartOffset,
    runLimit,
    universeCount,
    targetCount: input.targetCount,
    processedCount: 0,
    successCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    unconfirmedCount: 0,
    hiddenCount: 0,
    republishedCount: 0,
    errorCount: 0,
    cursor,
    batchSize: input.batchSize ?? FANZA_SYNC_DEFAULT_BATCH_SIZE,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    lastProcessedContentId: null,
    message: "同期を開始しました。",
    lockOwner: jobId,
  };
}

export function isFanzaSyncJobRunning(job: FanzaSyncJob | null): boolean {
  return job?.status === "running" || job?.status === "pending";
}

export function isFanzaSyncJobStale(
  job: FanzaSyncJob,
  staleMs: number,
  now = Date.now(),
): boolean {
  if (!isFanzaSyncJobRunning(job)) return false;
  const updatedAt = Date.parse(job.updatedAt);
  return !Number.isFinite(updatedAt) || now - updatedAt >= staleMs;
}

export function fanzaSyncProgressPercent(job: FanzaSyncJob): number {
  if (job.targetCount <= 0) return 0;
  return Math.min(100, Math.round((job.processedCount / job.targetCount) * 100));
}

export function fanzaSyncStatusLabel(status: FanzaSyncJobStatus): string {
  switch (status) {
    case "pending":
      return "待機中";
    case "running":
      return "実行中";
    case "completed":
      return "完了";
    case "partial_failed":
      return "一部失敗";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

export function toHistoryEntry(job: FanzaSyncJob): FanzaSyncHistoryEntry {
  return {
    jobId: job.jobId,
    trigger: job.trigger,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    targetCount: job.targetCount,
    successCount: job.successCount,
    updatedCount: job.updatedCount,
    unconfirmedCount: job.unconfirmedCount,
    hiddenCount: job.hiddenCount,
    republishedCount: job.republishedCount,
    errorCount: job.errorCount,
    status: job.status,
  };
}

export function parseFanzaSyncJob(raw: unknown): FanzaSyncJob | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<FanzaSyncJob>;
  if (!value.jobId || !value.startedAt) return null;

  const validStatuses = new Set<FanzaSyncJobStatus>([
    "pending",
    "running",
    "completed",
    "partial_failed",
    "failed",
  ]);

  const targetScope =
    value.targetScope === "unchecked" ? "unchecked" : "all";

  return {
    jobId: value.jobId,
    trigger: value.trigger === "auto" ? "auto" : "manual",
    status: validStatuses.has(value.status as FanzaSyncJobStatus)
      ? (value.status as FanzaSyncJobStatus)
      : "failed",
    mode: value.mode,
    targetScope,
    runStartOffset: Number(value.runStartOffset ?? 0),
    runLimit: Number(value.runLimit ?? value.targetCount ?? 0),
    universeCount: Number(value.universeCount ?? value.targetCount ?? 0),
    targetCount: Number(value.targetCount ?? 0),
    processedCount: Number(value.processedCount ?? 0),
    successCount: Number(value.successCount ?? 0),
    updatedCount: Number(value.updatedCount ?? 0),
    unchangedCount: Number(value.unchangedCount ?? 0),
    unconfirmedCount: Number(value.unconfirmedCount ?? 0),
    hiddenCount: Number(value.hiddenCount ?? 0),
    republishedCount: Number(value.republishedCount ?? 0),
    errorCount: Number(value.errorCount ?? 0),
    cursor: Number(value.cursor ?? 0),
    batchSize: Number(value.batchSize ?? FANZA_SYNC_DEFAULT_BATCH_SIZE),
    startedAt: value.startedAt,
    updatedAt: value.updatedAt ?? value.startedAt,
    completedAt: value.completedAt ?? null,
    lastProcessedContentId: value.lastProcessedContentId ?? null,
    message: value.message ?? null,
    lockOwner: value.lockOwner ?? null,
  };
}

export function parseFanzaSyncSnapshot(raw: unknown): FanzaSyncJobSnapshot {
  if (!raw || typeof raw !== "object") {
    return createEmptyFanzaSyncSnapshot();
  }

  const value = raw as Partial<FanzaSyncJobSnapshot>;
  const currentJob = value.currentJob ? parseFanzaSyncJob(value.currentJob) : null;
  const history = Array.isArray(value.history)
    ? value.history
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Partial<FanzaSyncHistoryEntry>;
          if (!record.jobId || !record.startedAt) return null;
          return {
            jobId: record.jobId,
            trigger: record.trigger === "auto" ? "auto" : "manual",
            startedAt: record.startedAt,
            completedAt: record.completedAt ?? null,
            targetCount: Number(record.targetCount ?? 0),
            successCount: Number(record.successCount ?? 0),
            updatedCount: Number(record.updatedCount ?? 0),
            unconfirmedCount: Number(record.unconfirmedCount ?? 0),
            hiddenCount: Number(record.hiddenCount ?? 0),
            republishedCount: Number(record.republishedCount ?? 0),
            errorCount: Number(record.errorCount ?? 0),
            status: (record.status as FanzaSyncJobStatus) ?? "completed",
          } satisfies FanzaSyncHistoryEntry;
        })
        .filter((entry): entry is FanzaSyncHistoryEntry => entry !== null)
    : [];

  return { currentJob, history };
}

export function serializeFanzaSyncSnapshot(snapshot: FanzaSyncJobSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
