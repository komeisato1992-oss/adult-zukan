import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  createEmptyBatchJob,
  parseBatchJob,
  serializeBatchJob,
  type ImportBatchJob,
} from "@/lib/admin/import-batch-job";
import { IMPORT_BATCH_JOB_RELATIVE_PATH } from "@/lib/admin/import-batch-job-path";

const JOB_FILE = path.join(process.cwd(), IMPORT_BATCH_JOB_RELATIVE_PATH);

let batchJobInProgress = false;

export function isBatchJobInProgress(): boolean {
  return batchJobInProgress;
}

export function setBatchJobInProgress(active: boolean): void {
  batchJobInProgress = active;
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
): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    const { commitBatchJobToGitHub } = await import(
      "@/lib/admin/github-import-batch-job"
    );
    await commitBatchJobToGitHub(job, sha, message);
    return;
  }

  writeLocal(job);
}
