import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  createEmptyBatchJob,
  isBatchJobActive,
  isBatchJobStale,
  isBatchJobTerminal,
  parseBatchJob,
  recoverCompletedBatchJobFromCollectionState,
  releaseBatchJobLock,
  serializeBatchJob,
  type ImportBatchJob,
} from "@/lib/admin/import-batch-job";
import { IMPORT_BATCH_JOB_RELATIVE_PATH } from "@/lib/admin/import-batch-job-path";
import { loadImportCollectionState } from "@/lib/admin/import-collection-state-store";
import {
  IMPORT_BATCH_JOB_STALE_MS,
  IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES,
} from "@/lib/admin/import-constants";
import { GitHubBatchJobError } from "@/lib/admin/github-import-batch-job";

const JOB_FILE = path.join(process.cwd(), IMPORT_BATCH_JOB_RELATIVE_PATH);

let batchJobInProgress = false;

export function isBatchJobInProgress(): boolean {
  return batchJobInProgress;
}

export function setBatchJobInProgress(active: boolean): void {
  batchJobInProgress = active;
}

export class ImportBatchJobConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportBatchJobConflictError";
  }
}

function readLocal(): ImportBatchJob {
  if (!existsSync(JOB_FILE)) {
    return createEmptyBatchJob();
  }

  try {
    return parseBatchJob(JSON.parse(readFileSync(JOB_FILE, "utf-8")));
  } catch {
    return createEmptyBatchJob();
  }
}

function writeLocal(job: ImportBatchJob): void {
  mkdirSync(path.dirname(JOB_FILE), { recursive: true });
  writeFileSync(JOB_FILE, serializeBatchJob(job), "utf-8");
}

export async function loadImportBatchJob(): Promise<{
  job: ImportBatchJob;
  sha: string | null;
}> {
  if (isGitHubCatalogConfigured()) {
    const { fetchBatchJobFromGitHub } = await import(
      "@/lib/admin/github-import-batch-job"
    );
    return fetchBatchJobFromGitHub();
  }

  return { job: readLocal(), sha: null };
}

export async function saveImportBatchJob(
  job: ImportBatchJob,
  sha: string | null,
  message: string,
): Promise<string | null> {
  if (isGitHubCatalogConfigured()) {
    const { commitBatchJobToGitHub } = await import(
      "@/lib/admin/github-import-batch-job"
    );
    return commitBatchJobToGitHub(job, sha, message);
  }

  writeLocal(job);
  return null;
}

function isGitHubConflict(error: unknown): boolean {
  return (
    error instanceof GitHubBatchJobError &&
    (error.status === 409 || error.status === 422)
  );
}

function markStaleJobFailed(job: ImportBatchJob): ImportBatchJob {
  return releaseBatchJobLock(job, "failed", {
    progressMessage: "10分以上更新がないため異常終了しました。",
    errorCode: "STALE_BATCH_TIMEOUT",
  });
}

async function normalizeLoadedJob(job: ImportBatchJob): Promise<ImportBatchJob> {
  const { state } = await loadImportCollectionState();

  const recoveredFromCollection =
    recoverCompletedBatchJobFromCollectionState(job, state);
  if (recoveredFromCollection) {
    return recoveredFromCollection;
  }

  if (isBatchJobStale(job, IMPORT_BATCH_JOB_STALE_MS)) {
    return markStaleJobFailed(job);
  }

  return job;
}

export async function readImportBatchJobForDisplay(): Promise<ImportBatchJob> {
  const { job } = await loadImportBatchJob();
  return normalizeLoadedJob(job);
}

async function saveWithConflictRetry(
  buildNext: (current: ImportBatchJob) => ImportBatchJob | Promise<ImportBatchJob>,
  message: string,
): Promise<ImportBatchJob> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES;
    attempt += 1
  ) {
    const { job: currentRaw, sha } = await loadImportBatchJob();
    const current = await normalizeLoadedJob(currentRaw);
    const next = await buildNext(current);

    try {
      await saveImportBatchJob(next, sha, message);
      return next;
    } catch (error) {
      if (
        !isGitHubConflict(error) ||
        attempt === IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

function jobNeedsPersist(
  raw: ImportBatchJob,
  normalized: ImportBatchJob,
): boolean {
  return (
    raw.status !== normalized.status ||
    raw.activeJobId !== normalized.activeJobId ||
    raw.phase !== normalized.phase ||
    raw.completedAt !== normalized.completedAt
  );
}

export async function recoverStaleImportBatchJob(): Promise<ImportBatchJob> {
  const { job: currentRaw } = await loadImportBatchJob();
  const normalized = await normalizeLoadedJob(currentRaw);

  if (!jobNeedsPersist(currentRaw, normalized)) {
    return normalized;
  }

  return saveWithConflictRetry(() => normalized, "Recover stale import batch job");
}

export async function claimImportBatchJob(
  newJob: ImportBatchJob,
  idempotencyKey?: string | null,
): Promise<ImportBatchJob> {
  return saveWithConflictRetry((current) => {
    const normalized = isBatchJobStale(current, IMPORT_BATCH_JOB_STALE_MS)
      ? markStaleJobFailed(current)
      : current;

    if (
      idempotencyKey &&
      normalized.idempotencyKey === idempotencyKey &&
      normalized.processId
    ) {
      return normalized;
    }

    if (isBatchJobActive(normalized, IMPORT_BATCH_JOB_STALE_MS)) {
      throw new ImportBatchJobConflictError(
        `現在処理中です（${normalized.fetchedCount.toLocaleString()}件取得済み）`,
      );
    }

    const now = new Date().toISOString();
    return {
      ...newJob,
      status: "running",
      activeJobId: newJob.processId,
      idempotencyKey: idempotencyKey ?? null,
      updatedAt: now,
      createdAt: newJob.createdAt || now,
      completedAt: null,
      errorCode: null,
    };
  }, "Start popular batch collect");
}

export async function updateImportBatchJob(
  processId: string,
  update: (
    current: ImportBatchJob,
  ) => ImportBatchJob | Promise<ImportBatchJob>,
  message: string,
): Promise<ImportBatchJob> {
  return saveWithConflictRetry(async (current) => {
    if (current.processId !== processId) {
      if (
        isBatchJobTerminal(current) ||
        isBatchJobStale(current, IMPORT_BATCH_JOB_STALE_MS) ||
        !isBatchJobActive(current, IMPORT_BATCH_JOB_STALE_MS)
      ) {
        const next = await update(current);
        return {
          ...next,
          processId,
          activeJobId: next.status === "running" ? processId : null,
          updatedAt: new Date().toISOString(),
        };
      }

      throw new ImportBatchJobConflictError(
        "別のバッチジョブが開始されているため、状態を更新できません。",
      );
    }

    const next = await update(current);
    return {
      ...next,
      activeJobId: next.status === "running" ? processId : null,
      updatedAt: new Date().toISOString(),
    };
  }, message);
}

export async function releaseImportBatchJobLock(
  processId: string,
  status: "completed" | "failed" | "idle",
  patch: Partial<ImportBatchJob> = {},
): Promise<ImportBatchJob> {
  return saveWithConflictRetry(
    (current) =>
      releaseBatchJobLock(
        current.processId === processId
          ? current
          : { ...current, processId },
        status,
        patch,
      ),
    `Release import batch job lock (${status})`,
  );
}
