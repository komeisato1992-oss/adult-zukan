import {
  WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
  type WorksMasterMigrationBatchLog,
  type WorksMasterMigrationError,
  type WorksMasterMigrationJob,
  type WorksMasterMigrationStatus,
} from "@/lib/admin/works-master-migration-types";

export function createWorksMasterMigrationJobId(): string {
  return `works-mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createIdleWorksMasterMigrationJob(): WorksMasterMigrationJob {
  const now = new Date().toISOString();
  return {
    jobId: "idle",
    status: "idle",
    batchSize: WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
    cursor: 0,
    jsonTotalCount: 0,
    jsonUniqueCidCount: 0,
    jsonDuplicateCidCount: 0,
    supabaseCountBefore: 0,
    supabaseOverlapBefore: 0,
    targetCount: 0,
    processedCount: 0,
    addedCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    startedAt: null,
    updatedAt: now,
    completedAt: null,
    lastProcessedCid: null,
    stopReason: null,
    message: null,
    batchLogs: [],
    errors: [],
    totalDurationMs: 0,
    estimatedRemainingMs: null,
    supabaseCountAfter: null,
  };
}

export function createWorksMasterMigrationJob(input: {
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
  supabaseCountBefore: number;
  supabaseOverlapBefore: number;
  batchSize?: number;
}): WorksMasterMigrationJob {
  const now = new Date().toISOString();
  return {
    jobId: createWorksMasterMigrationJobId(),
    status: "running",
    batchSize: input.batchSize ?? WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
    cursor: 0,
    jsonTotalCount: input.jsonTotalCount,
    jsonUniqueCidCount: input.jsonUniqueCidCount,
    jsonDuplicateCidCount: input.jsonDuplicateCidCount,
    supabaseCountBefore: input.supabaseCountBefore,
    supabaseOverlapBefore: input.supabaseOverlapBefore,
    targetCount: input.jsonUniqueCidCount,
    processedCount: 0,
    addedCount: 0,
    updatedCount: 0,
    duplicateCount: input.jsonDuplicateCidCount,
    failedCount: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    lastProcessedCid: null,
    stopReason: null,
    message: "移行を開始しました。",
    batchLogs: [],
    errors: [],
    totalDurationMs: 0,
    estimatedRemainingMs: null,
    supabaseCountAfter: null,
  };
}

export function worksMasterMigrationProgressPercent(
  job: WorksMasterMigrationJob,
): number {
  if (job.targetCount <= 0) return 0;
  return Math.min(
    100,
    Math.round((job.processedCount / job.targetCount) * 100),
  );
}

export function worksMasterMigrationRemainingCount(
  job: WorksMasterMigrationJob,
): number {
  return Math.max(0, job.targetCount - job.processedCount);
}

export function estimateWorksMasterMigrationRemainingMs(
  job: WorksMasterMigrationJob,
): number | null {
  const remaining = worksMasterMigrationRemainingCount(job);
  if (remaining <= 0) return 0;
  if (job.processedCount <= 0 || job.totalDurationMs <= 0) return null;
  const perItem = job.totalDurationMs / job.processedCount;
  return Math.round(perItem * remaining);
}

export function worksMasterMigrationStatusLabel(
  status: WorksMasterMigrationStatus,
): string {
  switch (status) {
    case "idle":
      return "未開始";
    case "running":
      return "実行中";
    case "paused":
      return "一時停止";
    case "completed":
      return "完了";
    case "failed":
      return "失敗";
    case "stopped":
      return "安全停止";
    default:
      return status;
  }
}

export function isWorksMasterMigrationResumable(
  job: WorksMasterMigrationJob | null,
): boolean {
  if (!job) return false;
  return (
    (job.status === "paused" ||
      job.status === "stopped" ||
      job.status === "failed" ||
      job.status === "running") &&
    job.processedCount < job.targetCount
  );
}

function parseBatchLog(raw: unknown): WorksMasterMigrationBatchLog | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<WorksMasterMigrationBatchLog>;
  return {
    batchIndex: Number(value.batchIndex ?? 0),
    startedAt: String(value.startedAt ?? ""),
    finishedAt: String(value.finishedAt ?? ""),
    durationMs: Number(value.durationMs ?? 0),
    processed: Number(value.processed ?? 0),
    added: Number(value.added ?? 0),
    updated: Number(value.updated ?? 0),
    duplicates: Number(value.duplicates ?? 0),
    failed: Number(value.failed ?? 0),
    lastCid: value.lastCid ? String(value.lastCid) : null,
    error: value.error ? String(value.error) : null,
  };
}

function parseError(raw: unknown): WorksMasterMigrationError | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<WorksMasterMigrationError>;
  if (!value.cid || !value.message) return null;
  return {
    cid: String(value.cid),
    batchIndex: Number(value.batchIndex ?? 0),
    message: String(value.message),
    at: String(value.at ?? new Date().toISOString()),
    code: value.code ? String(value.code) : undefined,
  };
}

export function parseWorksMasterMigrationJob(
  raw: unknown,
): WorksMasterMigrationJob | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<WorksMasterMigrationJob>;
  if (!value.jobId) return null;

  const validStatuses = new Set<WorksMasterMigrationStatus>([
    "idle",
    "running",
    "paused",
    "completed",
    "failed",
    "stopped",
  ]);

  return {
    jobId: String(value.jobId),
    status: validStatuses.has(value.status as WorksMasterMigrationStatus)
      ? (value.status as WorksMasterMigrationStatus)
      : "idle",
    batchSize: Number(
      value.batchSize ?? WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
    ),
    cursor: Number(value.cursor ?? 0),
    jsonTotalCount: Number(value.jsonTotalCount ?? 0),
    jsonUniqueCidCount: Number(value.jsonUniqueCidCount ?? 0),
    jsonDuplicateCidCount: Number(value.jsonDuplicateCidCount ?? 0),
    supabaseCountBefore: Number(value.supabaseCountBefore ?? 0),
    supabaseOverlapBefore: Number(value.supabaseOverlapBefore ?? 0),
    targetCount: Number(value.targetCount ?? 0),
    processedCount: Number(value.processedCount ?? 0),
    addedCount: Number(value.addedCount ?? 0),
    updatedCount: Number(value.updatedCount ?? 0),
    duplicateCount: Number(value.duplicateCount ?? 0),
    failedCount: Number(value.failedCount ?? 0),
    startedAt: value.startedAt ? String(value.startedAt) : null,
    updatedAt: String(value.updatedAt ?? value.startedAt ?? new Date().toISOString()),
    completedAt: value.completedAt ? String(value.completedAt) : null,
    lastProcessedCid: value.lastProcessedCid
      ? String(value.lastProcessedCid)
      : null,
    stopReason: value.stopReason ? String(value.stopReason) : null,
    message: value.message ? String(value.message) : null,
    batchLogs: Array.isArray(value.batchLogs)
      ? value.batchLogs
          .map(parseBatchLog)
          .filter((entry): entry is WorksMasterMigrationBatchLog => Boolean(entry))
      : [],
    errors: Array.isArray(value.errors)
      ? value.errors
          .map(parseError)
          .filter((entry): entry is WorksMasterMigrationError => Boolean(entry))
      : [],
    totalDurationMs: Number(value.totalDurationMs ?? 0),
    estimatedRemainingMs:
      value.estimatedRemainingMs == null
        ? null
        : Number(value.estimatedRemainingMs),
    supabaseCountAfter:
      value.supabaseCountAfter == null
        ? null
        : Number(value.supabaseCountAfter),
  };
}

export function serializeWorksMasterMigrationJob(
  job: WorksMasterMigrationJob,
): string {
  return `${JSON.stringify(job, null, 2)}\n`;
}

export function buildWorksMasterMigrationErrorsCsv(
  job: WorksMasterMigrationJob,
): string {
  const header = "cid,batchIndex,code,message,at";
  const rows = job.errors.map((error) => {
    const cells = [
      error.cid,
      String(error.batchIndex),
      error.code ?? "",
      error.message.replaceAll('"', '""'),
      error.at,
    ];
    return cells.map((cell) => `"${cell}"`).join(",");
  });
  return [header, ...rows].join("\n");
}
