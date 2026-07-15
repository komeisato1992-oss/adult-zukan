import "server-only";

import {
  normalizeCatalogContentId,
  readCatalogSnapshot,
} from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { dmmItemToWorkMasterRow } from "@/lib/dmm/works-master/map";
import {
  supabaseCountWorkMasterRows,
  supabaseFetchAllWorkMasterCids,
  supabaseUpsertWorkMasterRows,
} from "@/lib/dmm/works-master/supabase-store";
import {
  isWorksMasterSupabaseConfigured,
} from "@/lib/dmm/works-master/types";
import type { WorkMasterUpsertInput } from "@/lib/dmm/works-master/types";
import {
  createWorksMasterMigrationJob,
  estimateWorksMasterMigrationRemainingMs,
  isWorksMasterMigrationResumable,
  worksMasterMigrationProgressPercent,
  worksMasterMigrationRemainingCount,
} from "@/lib/admin/works-master-migration-job";
import {
  readWorksMasterMigrationJob,
  writeWorksMasterMigrationJob,
} from "@/lib/admin/works-master-migration-store";
import type {
  WorksMasterMigrationBatchLog,
  WorksMasterMigrationError,
  WorksMasterMigrationJob,
  WorksMasterMigrationStatusPayload,
} from "@/lib/admin/works-master-migration-types";
import { WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE } from "@/lib/admin/works-master-migration-types";

export type CatalogMigrationSource = {
  itemsByCid: Map<string, DmmItem>;
  orderedUniqueCids: string[];
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
};

export type FatalMigrationReason =
  | "rate_limit"
  | "connection"
  | "column_mismatch"
  | "timeout"
  | "supabase_error";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const obj = error as { message?: string; code?: string; details?: string };
    return [obj.message, obj.code, obj.details].filter(Boolean).join(" | ");
  }
  return String(error);
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return code == null ? undefined : String(code);
  }
  return undefined;
}

/** 無限リトライ禁止。これらは即安全停止。 */
export function classifyFatalMigrationError(
  error: unknown,
): FatalMigrationReason {
  const message = errorMessage(error).toLowerCase();
  const code = (errorCode(error) ?? "").toLowerCase();
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (
    status === 429 ||
    code === "429" ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "rate_limit";
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    code === "57014"
  ) {
    return "timeout";
  }

  if (
    code === "pgrst204" ||
    code === "42703" ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  ) {
    return "column_mismatch";
  }

  if (
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("network") ||
    message.includes("connect") ||
    message.includes("unavailable") ||
    code === "pgrst301"
  ) {
    return "connection";
  }

  return "supabase_error";
}

export function fatalReasonLabel(reason: FatalMigrationReason): string {
  switch (reason) {
    case "rate_limit":
      return "429 Rate Limit";
    case "connection":
      return "Supabase接続エラー";
    case "column_mismatch":
      return "カラム不一致";
    case "timeout":
      return "タイムアウト";
    case "supabase_error":
      return "Supabaseエラー";
    default:
      return reason;
  }
}

export function loadCatalogMigrationSource(): CatalogMigrationSource {
  const items = readCatalogSnapshot();
  const itemsByCid = new Map<string, DmmItem>();
  let duplicateCount = 0;

  for (const item of items) {
    const cid = normalizeCatalogContentId(item.content_id);
    if (!cid) continue;
    if (itemsByCid.has(cid)) {
      duplicateCount += 1;
      // 先勝ち（既存JSONの出現順）。Supabase優先は読み取り時。
      continue;
    }
    itemsByCid.set(cid, item);
  }

  return {
    itemsByCid,
    orderedUniqueCids: [...itemsByCid.keys()],
    jsonTotalCount: items.length,
    jsonUniqueCidCount: itemsByCid.size,
    jsonDuplicateCidCount: duplicateCount,
  };
}

export async function previewWorksMasterMigration(): Promise<{
  jsonTotalCount: number;
  jsonUniqueCidCount: number;
  jsonDuplicateCidCount: number;
  supabaseCountBefore: number;
  supabaseOverlapBefore: number;
  supabaseConfigured: boolean;
}> {
  const source = loadCatalogMigrationSource();
  const supabaseConfigured = isWorksMasterSupabaseConfigured();
  let supabaseCountBefore = 0;
  let supabaseOverlapBefore = 0;

  if (supabaseConfigured) {
    const existing = await supabaseFetchAllWorkMasterCids();
    supabaseCountBefore = existing.length;
    const existingSet = new Set(existing);
    for (const cid of source.orderedUniqueCids) {
      if (existingSet.has(cid)) supabaseOverlapBefore += 1;
    }
  }

  return {
    jsonTotalCount: source.jsonTotalCount,
    jsonUniqueCidCount: source.jsonUniqueCidCount,
    jsonDuplicateCidCount: source.jsonDuplicateCidCount,
    supabaseCountBefore,
    supabaseOverlapBefore,
    supabaseConfigured,
  };
}

function buildRowsForCids(
  source: CatalogMigrationSource,
  cids: string[],
  now: string,
): { rows: WorkMasterUpsertInput[]; skipped: WorksMasterMigrationError[] } {
  const rows: WorkMasterUpsertInput[] = [];
  const skipped: WorksMasterMigrationError[] = [];

  for (const cid of cids) {
    const item = source.itemsByCid.get(cid);
    if (!item) {
      skipped.push({
        cid,
        batchIndex: -1,
        message: "カタログに作品が見つかりません",
        at: now,
        code: "missing_item",
      });
      continue;
    }
    const row = dmmItemToWorkMasterRow(item, { published: true, now });
    if (!row) {
      skipped.push({
        cid,
        batchIndex: -1,
        message: "works行への変換に失敗",
        at: now,
        code: "map_failed",
      });
      continue;
    }
    // slug=cid を維持（既存 /works/{cid} URL・SEOを壊さない）
    row.slug = cid;
    rows.push(row);
  }

  return { rows, skipped };
}

export async function getWorksMasterMigrationStatus(): Promise<WorksMasterMigrationStatusPayload> {
  const job = readWorksMasterMigrationJob();
  const effective =
    job.status === "idle" && job.jobId === "idle" ? null : job;
  const remaining = effective
    ? worksMasterMigrationRemainingCount(effective)
    : 0;
  return {
    job: effective,
    remainingCount: remaining,
    progressPercent: effective
      ? worksMasterMigrationProgressPercent(effective)
      : 0,
    estimatedRemainingMs: effective
      ? estimateWorksMasterMigrationRemainingMs(effective)
      : null,
    jsonKeptAsFallback: true,
    deployRequired: false,
    gitWrite: false,
  };
}

export async function startWorksMasterMigration(options?: {
  batchSize?: number;
  forceRestart?: boolean;
}): Promise<{
  job: WorksMasterMigrationJob;
  preview: Awaited<ReturnType<typeof previewWorksMasterMigration>>;
  resumed: false;
}> {
  if (!isWorksMasterSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が未設定です。移行を開始できません。",
    );
  }

  const current = readWorksMasterMigrationJob();
  if (
    !options?.forceRestart &&
    isWorksMasterMigrationResumable(current) &&
    current.jobId !== "idle"
  ) {
    throw new Error(
      "未完了の移行ジョブがあります。途中再開を使うか、forceRestart で新規開始してください。",
    );
  }

  const preview = await previewWorksMasterMigration();
  const job = createWorksMasterMigrationJob({
    jsonTotalCount: preview.jsonTotalCount,
    jsonUniqueCidCount: preview.jsonUniqueCidCount,
    jsonDuplicateCidCount: preview.jsonDuplicateCidCount,
    supabaseCountBefore: preview.supabaseCountBefore,
    supabaseOverlapBefore: preview.supabaseOverlapBefore,
    batchSize: options?.batchSize ?? WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
  });
  job.message = `移行開始: JSON ${preview.jsonTotalCount}件 / ユニークCID ${preview.jsonUniqueCidCount}件 / Supabase既存 ${preview.supabaseCountBefore}件 / 重複CID ${preview.supabaseOverlapBefore}件`;
  writeWorksMasterMigrationJob(job);
  return { job, preview, resumed: false };
}

export async function resumeWorksMasterMigration(): Promise<{
  job: WorksMasterMigrationJob;
  resumed: boolean;
}> {
  const current = readWorksMasterMigrationJob();
  if (!isWorksMasterMigrationResumable(current) || current.jobId === "idle") {
    throw new Error("再開可能な移行ジョブがありません。");
  }
  if (!isWorksMasterSupabaseConfigured()) {
    throw new Error("Supabase未設定のため再開できません。");
  }

  const job: WorksMasterMigrationJob = {
    ...current,
    status: "running",
    stopReason: null,
    updatedAt: new Date().toISOString(),
    message: `cursor=${current.cursor} から再開します。`,
  };
  writeWorksMasterMigrationJob(job);
  return { job, resumed: true };
}

export type ProcessMigrationBatchResult = {
  job: WorksMasterMigrationJob;
  batch: WorksMasterMigrationBatchLog | null;
  done: boolean;
  stopped: boolean;
};

/**
 * 1バッチ（既定100件）だけ処理する。
 * Git / JSON書き換え / revalidate / deploy は行わない。
 */
export async function processWorksMasterMigrationBatch(): Promise<ProcessMigrationBatchResult> {
  const current = readWorksMasterMigrationJob();
  if (current.jobId === "idle" || current.status === "idle") {
    throw new Error("移行ジョブが開始されていません。");
  }
  if (current.status === "completed") {
    return { job: current, batch: null, done: true, stopped: false };
  }
  if (current.status === "stopped" || current.status === "failed") {
    return { job: current, batch: null, done: false, stopped: true };
  }
  if (!isWorksMasterSupabaseConfigured()) {
    const stopped: WorksMasterMigrationJob = {
      ...current,
      status: "stopped",
      stopReason: "supabase_not_configured",
      message: "Supabase未設定のため安全停止しました。",
      updatedAt: new Date().toISOString(),
    };
    writeWorksMasterMigrationJob(stopped);
    return { job: stopped, batch: null, done: false, stopped: true };
  }

  const source = loadCatalogMigrationSource();
  const batchSize = Math.max(1, current.batchSize || 100);
  const slice = source.orderedUniqueCids.slice(
    current.cursor,
    current.cursor + batchSize,
  );

  if (slice.length === 0) {
    const countAfter = await supabaseCountWorkMasterRows();
    const completed: WorksMasterMigrationJob = {
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supabaseCountAfter: countAfter,
      estimatedRemainingMs: 0,
      message: `移行完了。Supabase件数=${countAfter} / 対象ユニークCID=${current.targetCount}`,
    };
    writeWorksMasterMigrationJob(completed);
    return { job: completed, batch: null, done: true, stopped: false };
  }

  const batchIndex = current.batchLogs.length;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const now = startedAt;

  // 既存CID判定（追加/更新）
  let existingInBatch = new Set<string>();
  try {
    const { supabaseFetchWorkMasterByCids } = await import(
      "@/lib/dmm/works-master/supabase-store"
    );
    const existingMap = await supabaseFetchWorkMasterByCids(slice);
    existingInBatch = new Set(existingMap.keys());
  } catch (error) {
    const reason = classifyFatalMigrationError(error);
    const stopped = stopJobSafely(current, reason, error, batchIndex, slice[0] ?? null);
    return { job: stopped, batch: null, done: false, stopped: true };
  }

  const { rows, skipped } = buildRowsForCids(source, slice, now);
  const batchErrors: WorksMasterMigrationError[] = skipped.map((entry) => ({
    ...entry,
    batchIndex,
  }));

  let added = 0;
  let updated = 0;
  for (const row of rows) {
    if (existingInBatch.has(row.cid)) updated += 1;
    else added += 1;
  }

  try {
    await supabaseUpsertWorkMasterRows(rows);
  } catch (error) {
    const reason = classifyFatalMigrationError(error);
    const failed = rows.length;
    const durationMs = Date.now() - startedMs;
    const batchLog: WorksMasterMigrationBatchLog = {
      batchIndex,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      processed: 0,
      added: 0,
      updated: 0,
      duplicates: 0,
      failed,
      lastCid: slice[slice.length - 1] ?? null,
      error: `${fatalReasonLabel(reason)}: ${errorMessage(error)}`,
    };
    const stopped = stopJobSafely(
      {
        ...current,
        batchLogs: [...current.batchLogs, batchLog],
        errors: [
          ...current.errors,
          ...batchErrors,
          ...rows.map((row) => ({
            cid: row.cid,
            batchIndex,
            message: errorMessage(error),
            at: new Date().toISOString(),
            code: errorCode(error) ?? reason,
          })),
        ],
        failedCount: current.failedCount + failed + skipped.length,
        totalDurationMs: current.totalDurationMs + durationMs,
      },
      reason,
      error,
      batchIndex,
      slice[slice.length - 1] ?? null,
    );
    return { job: stopped, batch: batchLog, done: false, stopped: true };
  }

  const durationMs = Date.now() - startedMs;
  const lastCid = slice[slice.length - 1] ?? null;
  const processed = rows.length;
  const nextCursor = current.cursor + slice.length;
  const processedCount = current.processedCount + processed;
  const totalDurationMs = current.totalDurationMs + durationMs;

  const batchLog: WorksMasterMigrationBatchLog = {
    batchIndex,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs,
    processed,
    added,
    updated,
    duplicates: skipped.length,
    failed: skipped.length,
    lastCid,
    error: null,
  };

  let job: WorksMasterMigrationJob = {
    ...current,
    status: "running",
    cursor: nextCursor,
    processedCount,
    addedCount: current.addedCount + added,
    updatedCount: current.updatedCount + updated,
    failedCount: current.failedCount + skipped.length,
    lastProcessedCid: lastCid,
    updatedAt: new Date().toISOString(),
    batchLogs: [...current.batchLogs, batchLog],
    errors: [...current.errors, ...batchErrors],
    totalDurationMs,
    estimatedRemainingMs: null,
    message: `バッチ#${batchIndex + 1} 完了: +${added} / 更新${updated} / 失敗${skipped.length} (${durationMs}ms)`,
  };
  job.estimatedRemainingMs = estimateWorksMasterMigrationRemainingMs(job);

  const done = nextCursor >= source.orderedUniqueCids.length;
  if (done) {
    const countAfter = await supabaseCountWorkMasterRows();
    job = {
      ...job,
      status: "completed",
      completedAt: new Date().toISOString(),
      supabaseCountAfter: countAfter,
      estimatedRemainingMs: 0,
      message: `移行完了。追加${job.addedCount} / 更新${job.updatedCount} / 重複(JSON)${job.duplicateCount} / 失敗${job.failedCount} / Supabase=${countAfter}`,
    };
  }

  writeWorksMasterMigrationJob(job);
  return { job, batch: batchLog, done, stopped: false };
}

function stopJobSafely(
  job: WorksMasterMigrationJob,
  reason: FatalMigrationReason,
  error: unknown,
  batchIndex: number,
  lastCid: string | null,
): WorksMasterMigrationJob {
  const stopped: WorksMasterMigrationJob = {
    ...job,
    status: "stopped",
    stopReason: reason,
    lastProcessedCid: lastCid ?? job.lastProcessedCid,
    updatedAt: new Date().toISOString(),
    message: `安全停止: ${fatalReasonLabel(reason)} — ${errorMessage(error)}（batch#${batchIndex + 1}）。途中再開できます。`,
  };
  writeWorksMasterMigrationJob(stopped);
  return stopped;
}

/** CLI向け: 完了または安全停止までバッチを回す（無限リトライなし） */
export async function runWorksMasterMigrationToCompletion(options?: {
  batchSize?: number;
  forceRestart?: boolean;
  resume?: boolean;
  maxBatches?: number;
}): Promise<{
  job: WorksMasterMigrationJob;
  preview: Awaited<ReturnType<typeof previewWorksMasterMigration>> | null;
}> {
  let preview: Awaited<ReturnType<typeof previewWorksMasterMigration>> | null =
    null;
  const current = readWorksMasterMigrationJob();

  if (options?.resume && isWorksMasterMigrationResumable(current)) {
    await resumeWorksMasterMigration();
  } else if (
    current.status !== "running" ||
    current.jobId === "idle" ||
    options?.forceRestart
  ) {
    const started = await startWorksMasterMigration({
      batchSize: options?.batchSize,
      forceRestart: options?.forceRestart ?? current.jobId === "idle",
    });
    preview = started.preview;
  }

  let batches = 0;
  const maxBatches = options?.maxBatches ?? Number.POSITIVE_INFINITY;

  while (batches < maxBatches) {
    const result = await processWorksMasterMigrationBatch();
    batches += 1;
    if (result.done || result.stopped) {
      return { job: result.job, preview };
    }
  }

  const paused: WorksMasterMigrationJob = {
    ...readWorksMasterMigrationJob(),
    status: "paused",
    updatedAt: new Date().toISOString(),
    message: `maxBatches=${maxBatches} に到達したため一時停止。途中再開できます。`,
  };
  writeWorksMasterMigrationJob(paused);
  return { job: paused, preview };
}
