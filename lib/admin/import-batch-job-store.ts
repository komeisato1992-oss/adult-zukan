import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  createEmptyBatchJob,
  isBatchJobStale,
  isBatchJobTerminal,
  parseBatchJob,
  serializeBatchJob,
  type ImportBatchJob,
} from "@/lib/admin/import-batch-job";
import { IMPORT_BATCH_JOB_RELATIVE_PATH } from "@/lib/admin/import-batch-job-path";
import {
  IMPORT_BATCH_JOB_STALE_MS,
  IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES,
} from "@/lib/admin/import-constants";

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
    error instanceof Error &&
    "status" in error &&
    (error as Error & { status?: number }).status === 409
  );
}

function markStaleJobFailed(job: ImportBatchJob): ImportBatchJob {
  const now = new Date().toISOString();
  return {
    ...job,
    status: "failed",
    phase: "failed",
    progressMessage: "5分以上更新がないため異常終了しました。",
    errorCode: "STALE_BATCH_TIMEOUT",
    completedAt: now,
    updatedAt: now,
  };
}

async function saveWithConflictRetry(
  buildNext: (
    current: ImportBatchJob,
  ) => ImportBatchJob | Promise<ImportBatchJob>,
  message: string,
): Promise<ImportBatchJob> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= IMPORT_BATCH_JOB_UPDATE_MAX_RETRIES;
    attempt += 1
  ) {
    const { job: current, sha } = await loadImportBatchJob();
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

export async function recoverStaleImportBatchJob(): Promise<ImportBatchJob> {
  const { job } = await loadImportBatchJob();
  if (!isBatchJobStale(job, IMPORT_BATCH_JOB_STALE_MS)) {
    return job;
  }

  return saveWithConflictRetry(
    (current) =>
      isBatchJobStale(current, IMPORT_BATCH_JOB_STALE_MS)
        ? markStaleJobFailed(current)
        : current,
    "Fail stale popular batch job",
  );
}

export async function claimImportBatchJob(
  newJob: ImportBatchJob,
): Promise<ImportBatchJob> {
  return saveWithConflictRetry((current) => {
    const available = isBatchJobStale(current, IMPORT_BATCH_JOB_STALE_MS)
      ? markStaleJobFailed(current)
      : current;

    if (!isBatchJobTerminal(available)) {
      throw new ImportBatchJobConflictError(
        `現在処理中です（${available.fetchedCount.toLocaleString()}件取得済み）`,
      );
    }

    return {
      ...newJob,
      status: "running",
      updatedAt: new Date().toISOString(),
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
      throw new ImportBatchJobConflictError(
        "別のバッチジョブが開始されているため、状態を更新できません。",
      );
    }

    const next = await update(current);
    return {
      ...next,
      updatedAt: new Date().toISOString(),
    };
  }, message);
}
