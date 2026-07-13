import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";
import {
  DOUJIN_ITEMLIST_MAX_HITS,
  resolveDoujinFloorConfig,
  type DoujinFloorConfig,
} from "@/lib/doujin/floor-config";
import {
  DOUJIN_IMPORT_DEFAULT_FLOOR,
  DOUJIN_IMPORT_NEW_SORT,
  DOUJIN_IMPORT_NEW_TARGET,
  DOUJIN_IMPORT_OFFSET_MAX,
  DOUJIN_IMPORT_OFFSET_START,
  DOUJIN_IMPORT_POPULAR_SORT,
  DOUJIN_IMPORT_POPULAR_TARGET,
  getDoujinImportBatchSize,
  getDoujinImportMaxBatches,
  getDoujinImportMaxEmptyNewBatches,
  getDoujinImportMaxRetries,
  getDoujinImportRequestDelayMs,
} from "@/lib/doujin/import-config";
import { normalizeDoujinApiItem } from "@/lib/doujin/normalize";
import {
  appendDoujinFetchLog,
  loadDoujinImportJobById,
  loadDoujinImportJobs,
  loadLatestDoujinImportJob,
  upsertDoujinImportJob,
} from "@/lib/doujin/storage";
import type {
  DoujinImportJob,
  DoujinImportJobType,
  NormalizedDoujinApiItem,
} from "@/lib/doujin/types";
import {
  applyNormalizedDoujinItems,
  loadDoujinCatalogMutableState,
  persistDoujinCatalogMutableState,
} from "@/lib/doujin/upsert";
import {
  getDoujinAdminMaxBatchesPerRequest,
  isDoujinBatchedImportEnabled,
} from "@/lib/doujin/cost-flags";
import { getPerfSnapshot, resetPerfCounters } from "@/lib/perf/measure";
import { assertDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * Math.min(250, ms * 0.2));
}

function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = error.message.match(/DMM API request failed: (\d+)/);
  if (!match) return false;
  const status = Number(match[1]);
  return status === 401 || status === 403;
}

function isRetryableError(error: unknown): boolean {
  if (isAuthError(error)) return false;
  if (!(error instanceof Error)) return true;
  const match = error.message.match(/DMM API request failed: (\d+)/);
  if (!match) return true;
  const status = Number(match[1]);
  return status === 429 || status >= 500;
}

async function fetchImportPage(options: {
  hits: number;
  offset: number;
  sort: string;
  config: DoujinFloorConfig;
  maxRetries: number;
  signal?: AbortSignal;
}): Promise<{ items: DmmItem[]; totalCount: number; resultCount: number }> {
  const baseDelayMs = Number(process.env.FANZA_SYNC_RETRY_BASE_MS ?? 1000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    if (options.signal?.aborted) {
      throw new Error("Import aborted");
    }
    try {
      const response = await fetchDmmItemList({
        hits: options.hits,
        offset: options.offset,
        sort: options.sort as
          | "rank"
          | "date"
          | "price"
          | "review"
          | "-price"
          | "match",
        site: options.config.site,
        service: options.config.service,
        floor: options.config.floor,
        cache: "no-store",
      });
      return {
        items: response.result.items ?? [],
        totalCount: Number(response.result.total_count ?? 0),
        resultCount: Number(response.result.result_count ?? 0),
      };
    } catch (error) {
      lastError = error;
      if (isAuthError(error)) throw error;
      if (attempt >= options.maxRetries || !isRetryableError(error)) break;
      const delay = jitter(baseDelayMs * 2 ** (attempt - 1));
      appendDoujinFetchLog({
        level: "warn",
        message: `import retry attempt=${attempt} delay=${delay}`,
        detail: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Doujin import ItemList failed after retries");
}

function resolveFloor(
  overrides?: Partial<DoujinFloorConfig>,
): DoujinFloorConfig {
  const resolved = resolveDoujinFloorConfig({
    site: overrides?.site || DOUJIN_IMPORT_DEFAULT_FLOOR.site,
    service: overrides?.service || DOUJIN_IMPORT_DEFAULT_FLOOR.service,
    floor: overrides?.floor || DOUJIN_IMPORT_DEFAULT_FLOOR.floor,
  });
  if (!resolved.ok) throw new Error(resolved.error);
  return resolved.config;
}

function createJobId(jobType: DoujinImportJobType): string {
  return `${jobType.toLowerCase()}-${Date.now()}`;
}

function getRunningJob(): DoujinImportJob | undefined {
  return loadDoujinImportJobs().find((job) => job.status === "RUNNING");
}

export type StartDoujinImportOptions = {
  targetUniqueCount?: number;
  batchSize?: number;
  requestDelayMs?: number;
  dryRun?: boolean;
  resume?: boolean;
  site?: string;
  service?: string;
  floor?: string;
  startOffset?: number;
};

function buildJob(
  jobType: DoujinImportJobType,
  options: StartDoujinImportOptions = {},
): DoujinImportJob {
  const floor = resolveFloor(options);
  const sort =
    jobType === "POPULAR_INITIAL_IMPORT"
      ? DOUJIN_IMPORT_POPULAR_SORT
      : DOUJIN_IMPORT_NEW_SORT;
  const target =
    options.targetUniqueCount ??
    (jobType === "POPULAR_INITIAL_IMPORT"
      ? DOUJIN_IMPORT_POPULAR_TARGET
      : DOUJIN_IMPORT_NEW_TARGET);
  const batchSize = Math.min(
    DOUJIN_ITEMLIST_MAX_HITS,
    Math.max(1, options.batchSize ?? getDoujinImportBatchSize()),
  );
  const offset = Math.max(
    DOUJIN_IMPORT_OFFSET_START,
    options.startOffset ?? DOUJIN_IMPORT_OFFSET_START,
  );

  return {
    id: createJobId(jobType),
    jobType,
    status: "PENDING",
    targetUniqueCount: target,
    currentUniqueCount: 0,
    apiFetchedCount: 0,
    validItemCount: 0,
    newCreatedCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    popularOverlapCount: 0,
    existingDbDuplicateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    currentOffset: offset,
    nextOffset: offset,
    batchSize,
    sort,
    requestDelayMs: options.requestDelayMs ?? getDoujinImportRequestDelayMs(),
    maxRetries: getDoujinImportMaxRetries(),
    consecutiveEmptyNewBatches: 0,
    consecutiveErrors: 0,
    maxEmptyNewBatches: getDoujinImportMaxEmptyNewBatches(),
    maxBatches: getDoujinImportMaxBatches(),
    batchesProcessed: 0,
    dryRun: Boolean(options.dryRun),
    site: floor.site,
    service: floor.service,
    floor: floor.floor,
    countedWorkIds: [],
    metadata: {},
  };
}

function assertCanStart(
  jobType: DoujinImportJobType,
  options: StartDoujinImportOptions,
): DoujinImportJob | null {
  const running = getRunningJob();
  if (running) {
    throw new Error(
      `別のインポートジョブが実行中です: ${running.jobType} (${running.id})`,
    );
  }

  if (options.resume) {
    const latest = loadLatestDoujinImportJob(jobType);
    if (
      latest &&
      (latest.status === "PAUSED" ||
        latest.status === "FAILED" ||
        latest.status === "PENDING")
    ) {
      return latest;
    }
    if (latest?.status === "COMPLETED") {
      throw new Error(`${jobType} は既に完了しています（${latest.id}）`);
    }
  }

  if (jobType === "NEW_INITIAL_IMPORT") {
    const popularCompleted = loadDoujinImportJobs().some(
      (job) =>
        job.jobType === "POPULAR_INITIAL_IMPORT" &&
        job.status === "COMPLETED" &&
        !job.dryRun,
    );
    if (!popularCompleted) {
      throw new Error(
        "新着インポートは人気順インポート（POPULAR_INITIAL_IMPORT）の本登録完了後に開始できます",
      );
    }
  }

  return null;
}

export function startDoujinImportJob(
  jobType: DoujinImportJobType,
  options: StartDoujinImportOptions = {},
): DoujinImportJob {
  assertDoujinLocalWriteAllowed("doujin-import-start");
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }

  const resumable = assertCanStart(jobType, options);
  if (resumable) {
    const resumed: DoujinImportJob = {
      ...resumable,
      status: "RUNNING",
      pauseRequested: false,
      stopRequested: false,
      pausedAt: undefined,
      lastError: undefined,
      stopReason: undefined,
      startedAt: resumable.startedAt ?? new Date().toISOString(),
    };
    upsertDoujinImportJob(resumed);
    appendDoujinFetchLog({
      level: "info",
      message: `import resumed: ${jobType}`,
      jobId: resumed.id,
    });
    return resumed;
  }

  const job = buildJob(jobType, options);
  job.status = "RUNNING";
  job.startedAt = new Date().toISOString();
  upsertDoujinImportJob(job);
  appendDoujinFetchLog({
    level: "info",
    message: `import started: ${jobType}`,
    jobId: job.id,
    detail: {
      target: job.targetUniqueCount,
      dryRun: job.dryRun,
      batchSize: job.batchSize,
      sort: job.sort,
    },
  });
  return job;
}

export function requestPauseDoujinImport(jobId?: string): DoujinImportJob | null {
  const job = jobId
    ? loadDoujinImportJobById(jobId)
    : getRunningJob();
  if (!job || job.status !== "RUNNING") return job ?? null;
  const next = { ...job, pauseRequested: true };
  upsertDoujinImportJob(next);
  return next;
}

export function requestCancelDoujinImport(
  jobId?: string,
): DoujinImportJob | null {
  const job = jobId
    ? loadDoujinImportJobById(jobId)
    : getRunningJob() ?? loadLatestDoujinImportJob() ?? null;
  if (!job) return null;
  if (job.status === "COMPLETED" || job.status === "CANCELLED") return job;
  const next: DoujinImportJob = {
    ...job,
    stopRequested: true,
    pauseRequested: false,
    status: job.status === "RUNNING" ? "RUNNING" : "CANCELLED",
    stopReason: "cancelled_by_admin",
    completedAt:
      job.status === "RUNNING" ? job.completedAt : new Date().toISOString(),
  };
  if (next.status !== "RUNNING") {
    next.status = "CANCELLED";
    next.completedAt = new Date().toISOString();
  }
  upsertDoujinImportJob(next);
  return next;
}

function finalizeJob(
  job: DoujinImportJob,
  status: DoujinImportJob["status"],
  stopReason: string,
  lastError?: string,
): DoujinImportJob {
  const next: DoujinImportJob = {
    ...job,
    status,
    stopReason,
    lastError,
    pauseRequested: false,
    stopRequested: false,
    completedAt:
      status === "PAUSED" ? job.completedAt : new Date().toISOString(),
    pausedAt: status === "PAUSED" ? new Date().toISOString() : job.pausedAt,
    lastProcessedAt: new Date().toISOString(),
  };
  upsertDoujinImportJob(next);
  appendDoujinFetchLog({
    level: status === "FAILED" ? "error" : "info",
    message: `import ${status.toLowerCase()}: ${stopReason}`,
    jobId: job.id,
    detail: {
      currentUniqueCount: next.currentUniqueCount,
      apiFetchedCount: next.apiFetchedCount,
      nextOffset: next.nextOffset,
    },
  });
  return next;
}

export async function processDoujinImportBatch(
  jobId: string,
  signal?: AbortSignal,
  catalogState?: ReturnType<typeof loadDoujinCatalogMutableState>,
): Promise<{ job: DoujinImportJob; continueRunning: boolean }> {
  let job = loadDoujinImportJobById(jobId);
  if (!job) throw new Error(`Import job not found: ${jobId}`);
  if (job.status !== "RUNNING") {
    return { job, continueRunning: false };
  }

  if (job.stopRequested) {
    return {
      job: finalizeJob(job, "CANCELLED", job.stopReason ?? "cancelled"),
      continueRunning: false,
    };
  }
  if (job.pauseRequested) {
    return {
      job: finalizeJob(job, "PAUSED", "paused_by_admin"),
      continueRunning: false,
    };
  }

  if (job.currentUniqueCount >= job.targetUniqueCount) {
    return {
      job: finalizeJob(job, "COMPLETED", "target_reached"),
      continueRunning: false,
    };
  }

  if (job.batchesProcessed >= job.maxBatches) {
    return {
      job: finalizeJob(job, "PAUSED", "max_batches_reached"),
      continueRunning: false,
    };
  }

  if (job.nextOffset > DOUJIN_IMPORT_OFFSET_MAX) {
    return {
      job: finalizeJob(job, "PAUSED", "offset_limit_reached"),
      continueRunning: false,
    };
  }

  const floor = resolveFloor({
    site: job.site,
    service: job.service,
    floor: job.floor,
  });
  const currentOffset = job.nextOffset;

  let page: { items: DmmItem[]; totalCount: number; resultCount: number };
  try {
    page = await fetchImportPage({
      hits: job.batchSize,
      offset: currentOffset,
      sort: job.sort,
      config: floor,
      maxRetries: job.maxRetries,
      signal,
    });
    job.consecutiveErrors = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job = {
      ...job,
      consecutiveErrors: job.consecutiveErrors + 1,
      errorCount: job.errorCount + 1,
      lastError: message,
      lastProcessedAt: new Date().toISOString(),
    };
    upsertDoujinImportJob(job);
    if (isAuthError(error) || job.consecutiveErrors >= 5) {
      return {
        job: finalizeJob(job, "FAILED", "api_error", message),
        continueRunning: false,
      };
    }
    await sleep(jitter(job.requestDelayMs * 2));
    return { job, continueRunning: true };
  }

  if (
    job.apiSearchTotalCount != null &&
    currentOffset > job.apiSearchTotalCount &&
    page.items.length === 0
  ) {
    return {
      job: finalizeJob(job, "PAUSED", "total_count_exceeded"),
      continueRunning: false,
    };
  }

  if (page.items.length === 0) {
    return {
      job: finalizeJob(
        {
          ...job,
          apiSearchTotalCount: page.totalCount,
          lastProcessedAt: new Date().toISOString(),
        },
        "PAUSED",
        "empty_api_page",
      ),
      continueRunning: false,
    };
  }

  const nextOffset = currentOffset + page.items.length;
  if (nextOffset === currentOffset) {
    return {
      job: finalizeJob(job, "FAILED", "offset_not_advancing"),
      continueRunning: false,
    };
  }

  const normalized: NormalizedDoujinApiItem[] = [];
  let skipped = 0;
  for (const raw of page.items) {
    const result = normalizeDoujinApiItem(raw, floor);
    if (!result.ok) {
      skipped += 1;
      continue;
    }
    normalized.push(result.item);
  }

  const state = catalogState ?? loadDoujinCatalogMutableState();
  const upsert = applyNormalizedDoujinItems(state, normalized, {
    jobId: job.id,
    dryRun: job.dryRun,
    popularityBaseOffset:
      job.jobType === "POPULAR_INITIAL_IMPORT" ? currentOffset : undefined,
    importMetaBaseOffset: currentOffset,
    importPhase:
      job.jobType === "POPULAR_INITIAL_IMPORT" ? "POPULAR" : "NEW",
  });

  // 単発呼び出し時のみここで保存。スライス処理では呼び出し側がまとめて保存する。
  if (!catalogState && !job.dryRun) {
    persistDoujinCatalogMutableState(state, { revalidatePublicCatalog: true });
  }

  const counted = new Set(job.countedWorkIds);
  let uniqueDelta = 0;
  let popularOverlap = 0;
  let existingDup = 0;

  for (const row of upsert.results) {
    if (job.jobType === "POPULAR_INITIAL_IMPORT") {
      if (!counted.has(row.workId)) {
        counted.add(row.workId);
        uniqueDelta += 1;
      } else {
        existingDup += 1;
      }
    } else if (row.created) {
      if (!counted.has(row.workId)) {
        counted.add(row.workId);
        uniqueDelta += 1;
      }
    } else if (row.wasPopularImport) {
      popularOverlap += 1;
      existingDup += 1;
    } else {
      existingDup += 1;
    }
  }

  const currentUniqueCount = Math.min(
    job.targetUniqueCount,
    job.currentUniqueCount + uniqueDelta,
  );
  const consecutiveEmptyNewBatches =
    job.jobType === "NEW_INITIAL_IMPORT" && uniqueDelta === 0
      ? job.consecutiveEmptyNewBatches + 1
      : 0;

  job = {
    ...job,
    apiFetchedCount: job.apiFetchedCount + page.items.length,
    apiSearchTotalCount: page.totalCount,
    validItemCount: job.validItemCount + normalized.length,
    newCreatedCount: job.newCreatedCount + upsert.created,
    updatedCount: job.updatedCount + upsert.updated,
    duplicateCount: job.duplicateCount + upsert.duplicate,
    popularOverlapCount: job.popularOverlapCount + popularOverlap,
    existingDbDuplicateCount: job.existingDbDuplicateCount + existingDup,
    skippedCount: job.skippedCount + skipped,
    errorCount: job.errorCount + upsert.errors,
    currentOffset,
    nextOffset,
    batchesProcessed: job.batchesProcessed + 1,
    currentUniqueCount,
    countedWorkIds: [...counted],
    consecutiveEmptyNewBatches,
    lastProcessedAt: new Date().toISOString(),
  };
  upsertDoujinImportJob(job);

  if (job.currentUniqueCount >= job.targetUniqueCount) {
    return {
      job: finalizeJob(job, "COMPLETED", "target_reached"),
      continueRunning: false,
    };
  }

  if (
    job.jobType === "NEW_INITIAL_IMPORT" &&
    consecutiveEmptyNewBatches >= job.maxEmptyNewBatches
  ) {
    return {
      job: finalizeJob(job, "PAUSED", "no_new_works_streak"),
      continueRunning: false,
    };
  }

  if (job.apiSearchTotalCount != null && nextOffset > job.apiSearchTotalCount) {
    return {
      job: finalizeJob(job, "PAUSED", "total_count_exceeded"),
      continueRunning: false,
    };
  }

  await sleep(jitter(Math.min(job.requestDelayMs, 250)));
  return { job, continueRunning: true };
}

/**
 * 1 HTTP リクエスト分だけ進める（既定: API 1バッチ）。
 * 完了までループしない。管理画面が繰り返し tick する。
 */
export async function processDoujinImportRequestSlice(
  jobId: string,
): Promise<{
  job: DoujinImportJob;
  continueRunning: boolean;
  perf: ReturnType<typeof getPerfSnapshot>;
  persisted: boolean;
}> {
  resetPerfCounters();
  const maxBatches = isDoujinBatchedImportEnabled()
    ? getDoujinAdminMaxBatchesPerRequest()
    : 1;

  const state = loadDoujinCatalogMutableState();
  let last = loadDoujinImportJobById(jobId);
  if (!last) throw new Error(`Import job not found: ${jobId}`);

  let continueRunning = last.status === "RUNNING";
  for (let i = 0; i < maxBatches && continueRunning; i += 1) {
    const result = await processDoujinImportBatch(jobId, undefined, state);
    last = result.job;
    continueRunning = result.continueRunning;
  }

  const persist = persistDoujinCatalogMutableState(state, {
    dryRun: last.dryRun,
    revalidatePublicCatalog: true,
  });

  return {
    job: last,
    continueRunning,
    perf: getPerfSnapshot(),
    persisted: persist.wroteAny,
  };
}

let activeRunner: Promise<DoujinImportJob | null> | null = null;
let activeJobId: string | null = null;

export function getActiveDoujinImportRunnerId(): string | null {
  return activeJobId;
}

/** ローカルCLI用: 完了までスライスを繰り返す（Vercel HTTP では使わない） */
export async function runDoujinImportUntilIdle(
  jobId: string,
): Promise<DoujinImportJob> {
  let last = loadDoujinImportJobById(jobId);
  if (!last) throw new Error(`Import job not found: ${jobId}`);

  while (last.status === "RUNNING") {
    const slice = await processDoujinImportRequestSlice(jobId);
    last = slice.job;
    if (!slice.continueRunning) break;
  }
  clearDoujinImportRunner(jobId);
  return last;
}

/** @deprecated 長時間 HTTP ループは使わない。CLI は runDoujinImportUntilIdle を使う。 */
export async function runDoujinImportLoop(
  jobId: string,
  signal?: AbortSignal,
): Promise<DoujinImportJob> {
  void signal;
  return runDoujinImportUntilIdle(jobId);
}

export function ensureDoujinImportRunner(jobId: string): void {
  // バックグラウンド無限ループは廃止。jobId をアクティブとして記録するのみ。
  if (activeJobId && activeJobId !== jobId) {
    throw new Error("別のインポートランナーが動作中です");
  }
  activeJobId = jobId;
  activeRunner = null;
}

export async function awaitDoujinImportRunner(): Promise<DoujinImportJob | null> {
  if (activeRunner) return activeRunner;
  if (!activeJobId) return null;
  return loadDoujinImportJobById(activeJobId) ?? null;
}

export function clearDoujinImportRunner(jobId?: string): void {
  if (!jobId || activeJobId === jobId) {
    activeJobId = null;
    activeRunner = null;
  }
}

export function getDoujinImportOverview() {
  const popular = loadLatestDoujinImportJob("POPULAR_INITIAL_IMPORT");
  const neu = loadLatestDoujinImportJob("NEW_INITIAL_IMPORT");
  const popularCount = popular?.currentUniqueCount ?? 0;
  const newCount = neu?.currentUniqueCount ?? 0;
  const running =
    loadDoujinImportJobs().find((job) => job.status === "RUNNING") ?? null;
  return {
    popular,
    new: neu,
    totalTarget:
      (popular?.targetUniqueCount ?? DOUJIN_IMPORT_POPULAR_TARGET) +
      (neu?.targetUniqueCount ?? DOUJIN_IMPORT_NEW_TARGET),
    totalUniqueProgress: popularCount + newCount,
    runningJobId: running?.id ?? activeJobId,
  };
}
