import type { ImportCollectExclusionStats } from "@/lib/admin/import-collect-types";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportWorkAddStatus =
  | "pending"
  | "validating"
  | "ready"
  | "added"
  | "skipped_existing"
  | "skipped_invalid"
  | "failed";

export type ImportBatchJobPhase =
  | "idle"
  | "collecting"
  | "validating"
  | "saving"
  | "github"
  | "completed"
  | "failed";

export type ImportBatchJobStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export type ImportBatchJobWorkEntry = {
  contentId: string;
  status: ImportWorkAddStatus;
  errorCode?: string;
  item?: DmmItem;
};

export type ImportBatchJobRunStats = {
  requestedCount: number;
  apiFetchedCount: number;
  validCandidateCount: number;
  addedCount: number;
  skippedExistingCount: number;
  excludedCount: number;
  failedCount: number;
  startOffset: number;
  nextOffset: number;
  exclusionStats: ImportCollectExclusionStats;
};

export type ImportBatchJob = {
  processId: string;
  status: ImportBatchJobStatus;
  phase: ImportBatchJobPhase;
  targetTotalCount: number;
  startOffset: number;
  requestCount: number;
  addLimit: number;
  maxBatches: number;
  batchesExecuted: number;
  currentCatalogCount: number;
  works: ImportBatchJobWorkEntry[];
  runStats: ImportBatchJobRunStats | null;
  progressMessage: string | null;
  validatingProgress: number;
  validatingTotal: number;
  currentPage: number;
  plannedPages: number;
  currentOffset: number;
  fetchedCount: number;
  estimatedRemainingCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  startSha: string | null;
  saveSha: string | null;
  retryCount: number;
  durationMs: number | null;
};

export function createEmptyBatchJob(): ImportBatchJob {
  const now = new Date().toISOString();
  return {
    processId: "",
    status: "idle",
    phase: "idle",
    targetTotalCount: 10000,
    startOffset: 1,
    requestCount: 500,
    addLimit: 500,
    maxBatches: 1,
    batchesExecuted: 0,
    currentCatalogCount: 0,
    works: [],
    runStats: null,
    progressMessage: null,
    validatingProgress: 0,
    validatingTotal: 0,
    currentPage: 0,
    plannedPages: 0,
    currentOffset: 1,
    fetchedCount: 0,
    estimatedRemainingCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    errorCode: null,
    startSha: null,
    saveSha: null,
    retryCount: 0,
    durationMs: null,
  };
}

export function createBatchProcessId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isBatchJobTerminal(job: ImportBatchJob): boolean {
  return (
    job.status === "idle" ||
    job.status === "completed" ||
    job.status === "failed"
  );
}

export function isBatchJobStale(
  job: ImportBatchJob,
  staleMs: number,
  now = Date.now(),
): boolean {
  if (job.status !== "running") return false;

  const updatedAt = Date.parse(job.updatedAt);
  return !Number.isFinite(updatedAt) || now - updatedAt >= staleMs;
}

export function parseBatchJob(raw: unknown): ImportBatchJob {
  const defaults = createEmptyBatchJob();
  if (!raw || typeof raw !== "object") return defaults;

  const value = raw as Record<string, unknown>;
  const phase = value.phase;
  const validPhases = new Set<ImportBatchJobPhase>([
    "idle",
    "collecting",
    "validating",
    "saving",
    "github",
    "completed",
    "failed",
  ]);

  const works = Array.isArray(value.works)
    ? (value.works as unknown[])
        .map((entry): ImportBatchJobWorkEntry | null => {
          if (!entry || typeof entry !== "object") return null;
          const work = entry as Record<string, unknown>;
          const contentId =
            typeof work.contentId === "string" ? work.contentId.trim() : "";
          if (!contentId) return null;
          const status = work.status;
          const validStatuses = new Set<ImportWorkAddStatus>([
            "pending",
            "validating",
            "ready",
            "added",
            "skipped_existing",
            "skipped_invalid",
            "failed",
          ]);
          return {
            contentId,
            status: validStatuses.has(status as ImportWorkAddStatus)
              ? (status as ImportWorkAddStatus)
              : "pending",
            errorCode:
              typeof work.errorCode === "string" ? work.errorCode : undefined,
            item:
              work.item && typeof work.item === "object"
                ? (work.item as DmmItem)
                : undefined,
          };
        })
        .filter((entry): entry is ImportBatchJobWorkEntry => entry !== null)
    : [];

  const parsedPhase = validPhases.has(phase as ImportBatchJobPhase)
    ? (phase as ImportBatchJobPhase)
    : defaults.phase;
  const rawStatus = value.status;
  const validStatuses = new Set<ImportBatchJobStatus>([
    "idle",
    "running",
    "completed",
    "failed",
  ]);
  const derivedStatus: ImportBatchJobStatus =
    parsedPhase === "completed"
      ? "completed"
      : parsedPhase === "failed"
        ? "failed"
        : parsedPhase === "idle"
          ? "idle"
          : "running";

  return {
    processId:
      typeof value.processId === "string" ? value.processId : defaults.processId,
    status: validStatuses.has(rawStatus as ImportBatchJobStatus)
      ? (rawStatus as ImportBatchJobStatus)
      : derivedStatus,
    phase: parsedPhase,
    targetTotalCount:
      typeof value.targetTotalCount === "number"
        ? Math.max(1, Math.floor(value.targetTotalCount))
        : defaults.targetTotalCount,
    startOffset:
      typeof value.startOffset === "number"
        ? Math.max(1, Math.floor(value.startOffset))
        : defaults.startOffset,
    requestCount:
      typeof value.requestCount === "number"
        ? Math.max(1, Math.floor(value.requestCount))
        : defaults.requestCount,
    addLimit:
      typeof value.addLimit === "number"
        ? Math.max(1, Math.floor(value.addLimit))
        : defaults.addLimit,
    maxBatches:
      typeof value.maxBatches === "number"
        ? Math.max(1, Math.floor(value.maxBatches))
        : defaults.maxBatches,
    batchesExecuted:
      typeof value.batchesExecuted === "number"
        ? Math.max(0, Math.floor(value.batchesExecuted))
        : 0,
    currentCatalogCount:
      typeof value.currentCatalogCount === "number"
        ? Math.max(0, Math.floor(value.currentCatalogCount))
        : 0,
    works,
    runStats:
      value.runStats && typeof value.runStats === "object"
        ? (value.runStats as ImportBatchJobRunStats)
        : null,
    progressMessage:
      typeof value.progressMessage === "string" ? value.progressMessage : null,
    validatingProgress:
      typeof value.validatingProgress === "number"
        ? Math.max(0, Math.floor(value.validatingProgress))
        : 0,
    validatingTotal:
      typeof value.validatingTotal === "number"
        ? Math.max(0, Math.floor(value.validatingTotal))
        : 0,
    currentPage:
      typeof value.currentPage === "number"
        ? Math.max(0, Math.floor(value.currentPage))
        : 0,
    plannedPages:
      typeof value.plannedPages === "number"
        ? Math.max(0, Math.floor(value.plannedPages))
        : 0,
    currentOffset:
      typeof value.currentOffset === "number"
        ? Math.max(1, Math.floor(value.currentOffset))
        : defaults.currentOffset,
    fetchedCount:
      typeof value.fetchedCount === "number"
        ? Math.max(0, Math.floor(value.fetchedCount))
        : 0,
    estimatedRemainingCount:
      typeof value.estimatedRemainingCount === "number"
        ? Math.max(0, Math.floor(value.estimatedRemainingCount))
        : 0,
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : defaults.createdAt,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : defaults.updatedAt,
    completedAt:
      typeof value.completedAt === "string" ? value.completedAt : null,
    errorCode: typeof value.errorCode === "string" ? value.errorCode : null,
    startSha: typeof value.startSha === "string" ? value.startSha : null,
    saveSha: typeof value.saveSha === "string" ? value.saveSha : null,
    retryCount:
      typeof value.retryCount === "number"
        ? Math.max(0, Math.floor(value.retryCount))
        : 0,
    durationMs:
      typeof value.durationMs === "number"
        ? Math.max(0, Math.floor(value.durationMs))
        : null,
  };
}

export function serializeBatchJob(job: ImportBatchJob): string {
  return `${JSON.stringify(job, null, 2)}\n`;
}
