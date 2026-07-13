import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";
import {
  DOUJIN_ITEMLIST_MAX_HITS,
  DOUJIN_ITEMLIST_MAX_OFFSET,
  resolveDoujinFloorConfig,
  type DoujinFloorConfig,
} from "@/lib/doujin/floor-config";
import { DOUJIN_IMPORT_DEFAULT_FLOOR } from "@/lib/doujin/import-config";
import { normalizeDoujinApiItem } from "@/lib/doujin/normalize";
import {
  expectedUpdateFields,
  syncModeLabel,
} from "@/lib/doujin/sync-diff";
import {
  DOUJIN_SYNC_MODE_FULL,
  DOUJIN_SYNC_MODE_LIGHT,
  getSyncBatchSizeForMode,
  isDoujinFullSyncEnabled,
  isDoujinLightSyncEnabled,
  type DoujinSyncMode,
} from "@/lib/doujin/sync-mode";
import {
  appendDoujinFetchLog,
  loadDoujinSyncJobById,
  loadDoujinSyncJobs,
  loadLatestDoujinSyncJob,
  upsertDoujinSyncJob,
} from "@/lib/doujin/storage";
import type { DoujinSyncJob, NormalizedDoujinApiItem } from "@/lib/doujin/types";
import {
  applyNormalizedDoujinItems,
  loadDoujinCatalogMutableState,
  persistDoujinCatalogMutableState,
} from "@/lib/doujin/upsert";
import {
  assertDoujinLocalWriteAllowed,
  isDoujinLocalWriteAllowed,
} from "@/lib/doujin/write-guard";
import { isVercelRuntime } from "@/lib/admin/runtime-fs";
import { getPerfSnapshot, resetPerfCounters } from "@/lib/perf/measure";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getRunningSyncJob(): DoujinSyncJob | undefined {
  return loadDoujinSyncJobs().find((job) => job.status === "RUNNING");
}

export type StartDoujinSyncOptions = {
  mode: DoujinSyncMode;
  batchSize?: number;
  startOffset?: number;
  dryRun?: boolean;
  resume?: boolean;
  limit?: number;
  site?: string;
  service?: string;
  floor?: string;
};

function assertSyncModeAllowed(mode: DoujinSyncMode): void {
  if (mode === DOUJIN_SYNC_MODE_LIGHT && !isDoujinLightSyncEnabled()) {
    throw new Error(
      "軽量同期は DOUJIN_LIGHT_SYNC_ENABLED=true のときだけ実行できます",
    );
  }
  if (mode === DOUJIN_SYNC_MODE_FULL && !isDoujinFullSyncEnabled()) {
    throw new Error(
      "完全同期は DOUJIN_FULL_SYNC_ENABLED=true のときだけ実行できます",
    );
  }
}

export function startDoujinSyncJob(
  options: StartDoujinSyncOptions,
): DoujinSyncJob {
  assertDoujinLocalWriteAllowed("doujin-sync-start");
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }
  assertSyncModeAllowed(options.mode);

  const running = getRunningSyncJob();
  if (running && !options.resume) {
    const startedMs = running.startedAt
      ? Date.parse(running.startedAt)
      : NaN;
    const stale =
      !Number.isFinite(startedMs) || Date.now() - startedMs > 10 * 60_000;
    if (stale) {
      finalizeSyncJob(running, "FAILED", "stale_running_job_cleared");
    } else {
      throw new Error(
        `別の同期ジョブが実行中です: ${running.mode} (${running.id})`,
      );
    }
  }

  if (options.resume) {
    const latest = loadLatestDoujinSyncJob(options.mode);
    if (
      latest &&
      (latest.status === "PAUSED" ||
        latest.status === "FAILED" ||
        latest.status === "PENDING")
    ) {
      const resumed: DoujinSyncJob = {
        ...latest,
        status: "RUNNING",
        pauseRequested: false,
        stopRequested: false,
        pausedAt: undefined,
        lastError: undefined,
        stopReason: undefined,
        updatedAt: new Date().toISOString(),
        startedAt: latest.startedAt ?? new Date().toISOString(),
      };
      upsertDoujinSyncJob(resumed);
      return resumed;
    }
  }

  const floor = resolveFloor(options);
  const batchSize = Math.min(
    DOUJIN_ITEMLIST_MAX_HITS,
    Math.max(1, options.batchSize ?? getSyncBatchSizeForMode(options.mode)),
  );
  const offset = Math.max(1, options.startOffset ?? 1);
  const job: DoujinSyncJob = {
    id: `${options.mode}-sync-${Date.now()}`,
    mode: options.mode,
    status: "RUNNING",
    sort: "rank",
    batchSize,
    currentOffset: offset,
    nextOffset: offset,
    targetCount: options.limit,
    apiFetchedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    batchesProcessed: 0,
    maxBatches: options.limit
      ? Math.ceil(options.limit / batchSize)
      : Math.ceil(DOUJIN_ITEMLIST_MAX_OFFSET / batchSize),
    estimatedJsonSaves: 0,
    rawShardsTouched: [],
    changedFields: [],
    dryRun: Boolean(options.dryRun),
    site: floor.site,
    service: floor.service,
    floor: floor.floor,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  upsertDoujinSyncJob(job);
  appendDoujinFetchLog({
    level: "info",
    message: `sync started: ${syncModeLabel(options.mode)}`,
    jobId: job.id,
    detail: {
      mode: job.mode,
      dryRun: job.dryRun,
      batchSize: job.batchSize,
      fields: expectedUpdateFields(job.mode),
    },
  });
  return job;
}

export function requestPauseDoujinSync(jobId?: string): DoujinSyncJob | null {
  const job = jobId ? loadDoujinSyncJobById(jobId) : getRunningSyncJob();
  if (!job || job.status !== "RUNNING") return job ?? null;
  const next = { ...job, pauseRequested: true, updatedAt: new Date().toISOString() };
  upsertDoujinSyncJob(next);
  return next;
}

export function requestCancelDoujinSync(jobId?: string): DoujinSyncJob | null {
  const job =
    (jobId ? loadDoujinSyncJobById(jobId) : undefined) ??
    getRunningSyncJob() ??
    loadLatestDoujinSyncJob() ??
    null;
  if (!job) return null;
  if (job.status === "COMPLETED" || job.status === "CANCELLED") return job;
  const next: DoujinSyncJob = {
    ...job,
    stopRequested: true,
    pauseRequested: false,
    status: job.status === "RUNNING" ? "RUNNING" : "CANCELLED",
    stopReason: "cancelled_by_admin",
    updatedAt: new Date().toISOString(),
    completedAt:
      job.status === "RUNNING" ? job.completedAt : new Date().toISOString(),
  };
  if (next.status !== "RUNNING") {
    next.status = "CANCELLED";
    next.completedAt = new Date().toISOString();
  }
  upsertDoujinSyncJob(next);
  return next;
}

function finalizeSyncJob(
  job: DoujinSyncJob,
  status: DoujinSyncJob["status"],
  stopReason: string,
  lastError?: string,
): DoujinSyncJob {
  const next: DoujinSyncJob = {
    ...job,
    status,
    stopReason,
    lastError,
    pauseRequested: false,
    stopRequested: false,
    updatedAt: new Date().toISOString(),
    completedAt:
      status === "PAUSED" ? job.completedAt : new Date().toISOString(),
    pausedAt: status === "PAUSED" ? new Date().toISOString() : job.pausedAt,
  };
  upsertDoujinSyncJob(next);
  appendDoujinFetchLog({
    level: status === "FAILED" ? "error" : "info",
    message: `sync ${status.toLowerCase()}: ${stopReason}`,
    jobId: job.id,
    detail: {
      mode: job.mode,
      apiFetchedCount: next.apiFetchedCount,
      updatedCount: next.updatedCount,
      unchangedCount: next.unchangedCount,
    },
  });
  return next;
}

async function fetchSyncPage(options: {
  hits: number;
  offset: number;
  sort: string;
  config: DoujinFloorConfig;
}): Promise<{ items: DmmItem[]; totalCount: number }> {
  const response = await fetchDmmItemList({
    hits: options.hits,
    offset: options.offset,
    sort: options.sort as "rank" | "date",
    site: options.config.site,
    service: options.config.service,
    floor: options.config.floor,
    cache: "no-store",
  });
  return {
    items: response.result.items ?? [],
    totalCount: Number(response.result.total_count ?? 0),
  };
}

/**
 * 1 HTTP リクエスト分だけ同期を進める（既定 1 バッチ）。
 */
export async function processDoujinSyncRequestSlice(jobId: string): Promise<{
  job: DoujinSyncJob;
  continueRunning: boolean;
  persisted: boolean;
  estimatedJsonSaves: number;
  rawShardCount: number;
  changedFields: string[];
  perf: ReturnType<typeof getPerfSnapshot>;
}> {
  if (!isDoujinLocalWriteAllowed()) {
    assertDoujinLocalWriteAllowed("doujin-sync-slice");
  }

  resetPerfCounters();
  let job = loadDoujinSyncJobById(jobId);
  if (!job) throw new Error(`Sync job not found: ${jobId}`);
  if (job.status !== "RUNNING") {
    return {
      job,
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: 0,
      rawShardCount: 0,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  if (job.stopRequested) {
    return {
      job: finalizeSyncJob(job, "CANCELLED", job.stopReason ?? "cancelled"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: 0,
      rawShardCount: 0,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }
  if (job.pauseRequested) {
    return {
      job: finalizeSyncJob(job, "PAUSED", "paused_by_admin"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: 0,
      rawShardCount: 0,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  if (job.batchesProcessed >= job.maxBatches) {
    return {
      job: finalizeSyncJob(job, "COMPLETED", "max_batches_reached"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: job.estimatedJsonSaves,
      rawShardCount: job.rawShardsTouched.length,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  if (job.nextOffset > DOUJIN_ITEMLIST_MAX_OFFSET) {
    return {
      job: finalizeSyncJob(job, "COMPLETED", "offset_limit_reached"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: job.estimatedJsonSaves,
      rawShardCount: job.rawShardsTouched.length,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  const floor = resolveFloor({
    site: job.site,
    service: job.service,
    floor: job.floor,
  });
  const currentOffset = job.nextOffset;
  const remaining =
    job.targetCount != null
      ? Math.max(0, job.targetCount - job.apiFetchedCount)
      : job.batchSize;
  if (remaining <= 0) {
    return {
      job: finalizeSyncJob(job, "COMPLETED", "limit_reached"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: job.estimatedJsonSaves,
      rawShardCount: job.rawShardsTouched.length,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }
  const hits = Math.min(job.batchSize, remaining);

  let page: { items: DmmItem[]; totalCount: number };
  try {
    page = await fetchSyncPage({
      hits,
      offset: currentOffset,
      sort: job.sort,
      config: floor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      job: finalizeSyncJob(job, "FAILED", "api_error", message),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: 0,
      rawShardCount: 0,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  if (page.items.length === 0) {
    return {
      job: finalizeSyncJob(job, "COMPLETED", "empty_api_page"),
      continueRunning: false,
      persisted: false,
      estimatedJsonSaves: job.estimatedJsonSaves,
      rawShardCount: job.rawShardsTouched.length,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
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

  const state = loadDoujinCatalogMutableState();
  const upsert = applyNormalizedDoujinItems(state, normalized, {
    jobId: job.id,
    dryRun: job.dryRun,
    syncMode: job.mode,
    popularityBaseOffset: currentOffset,
  });

  const persist = job.dryRun
    ? { wroteAny: false, wroteWorks: false, wroteRaw: false, revalidated: false }
    : persistDoujinCatalogMutableState(state, {
        dryRun: false,
        revalidatePublicCatalog: true,
        // 既存のみの軽量更新は works.json のみ。新規登録がある場合は関連JSONも保存
        scope:
          job.mode === DOUJIN_SYNC_MODE_LIGHT && upsert.created === 0
            ? "works"
            : "all",
      });

  const estimatedJsonSaves =
    job.estimatedJsonSaves + (upsert.changed ? 1 : 0);
  const rawShards = [
    ...new Set([...job.rawShardsTouched, ...upsert.rawShardsTouched]),
  ];
  const changedFields = [
    ...new Set([...job.changedFields, ...upsert.changedFields]),
  ];

  job = {
    ...job,
    apiFetchedCount: job.apiFetchedCount + page.items.length,
    createdCount: job.createdCount + upsert.created,
    updatedCount: job.updatedCount + upsert.updated,
    unchangedCount: job.unchangedCount + upsert.unchanged,
    duplicateCount: job.duplicateCount + upsert.duplicate,
    skippedCount: job.skippedCount + skipped,
    errorCount: job.errorCount + upsert.errors,
    currentOffset,
    nextOffset: currentOffset + page.items.length,
    batchesProcessed: job.batchesProcessed + 1,
    estimatedJsonSaves,
    rawShardsTouched: rawShards,
    changedFields,
    updatedAt: new Date().toISOString(),
  };

  if (
    job.targetCount != null &&
    job.apiFetchedCount >= job.targetCount
  ) {
    job = finalizeSyncJob(job, "COMPLETED", "limit_reached");
    return {
      job,
      continueRunning: false,
      persisted: persist.wroteAny,
      estimatedJsonSaves: job.estimatedJsonSaves,
      rawShardCount: job.rawShardsTouched.length,
      changedFields: job.changedFields,
      perf: getPerfSnapshot(),
    };
  }

  upsertDoujinSyncJob(job);
  await sleep(150);

  return {
    job,
    continueRunning: true,
    persisted: persist.wroteAny,
    estimatedJsonSaves: job.estimatedJsonSaves,
    rawShardCount: job.rawShardsTouched.length,
    changedFields: job.changedFields,
    perf: getPerfSnapshot(),
  };
}

/** ローカル CLI 用: 完了までスライスを繰り返す */
export async function runDoujinSyncUntilIdle(
  jobId: string,
): Promise<DoujinSyncJob> {
  let last = loadDoujinSyncJobById(jobId);
  if (!last) throw new Error(`Sync job not found: ${jobId}`);
  while (last.status === "RUNNING") {
    const slice = await processDoujinSyncRequestSlice(jobId);
    last = slice.job;
    if (!slice.continueRunning) break;
  }
  return last;
}

export function getDoujinSyncOverview() {
  return {
    light: loadLatestDoujinSyncJob(DOUJIN_SYNC_MODE_LIGHT),
    full: loadLatestDoujinSyncJob(DOUJIN_SYNC_MODE_FULL),
    runningJobId: getRunningSyncJob()?.id ?? null,
    writeAllowed: isDoujinLocalWriteAllowed(),
    lightEnabled: isDoujinLightSyncEnabled(),
    fullEnabled: isDoujinFullSyncEnabled(),
    isVercel: isVercelRuntime(),
    expectedFields: {
      light: expectedUpdateFields(DOUJIN_SYNC_MODE_LIGHT),
      full: expectedUpdateFields(DOUJIN_SYNC_MODE_FULL),
    },
  };
}

export async function syncDoujinWorks(options: StartDoujinSyncOptions): Promise<{
  job: DoujinSyncJob;
  continueRunning: boolean;
  persisted: boolean;
}> {
  const job = startDoujinSyncJob(options);
  const slice = await processDoujinSyncRequestSlice(job.id);
  return {
    job: slice.job,
    continueRunning: slice.continueRunning,
    persisted: slice.persisted,
  };
}
