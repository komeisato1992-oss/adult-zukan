import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import type { DmmItem } from "@/lib/dmm/types";
import {
  DOUJIN_FETCH_MAX_TOTAL,
  DOUJIN_ITEMLIST_MAX_HITS,
  DOUJIN_ITEMLIST_MAX_OFFSET,
  resolveDoujinFloorConfig,
  type DoujinFloorConfig,
} from "@/lib/doujin/floor-config";
import { normalizeDoujinApiItem } from "@/lib/doujin/normalize";
import {
  appendDoujinFetchLog,
  loadDoujinFetchJob,
  saveDoujinFetchJob,
} from "@/lib/doujin/storage";
import type { DoujinFetchJob, NormalizedDoujinApiItem } from "@/lib/doujin/types";
import {
  applyNormalizedDoujinItems,
  loadDoujinCatalogMutableState,
  persistDoujinCatalogMutableState,
} from "@/lib/doujin/upsert";
import { assertDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";
import { getDoujinAdminBatchSize } from "@/lib/doujin/cost-flags";
import { getPerfSnapshot, resetPerfCounters } from "@/lib/perf/measure";

export type DoujinFetchRequest = {
  hits: number;
  offset?: number;
  keyword?: string;
  /** 作品ID指定（keywordより優先） */
  contentId?: string;
  sort?: string;
  site?: string;
  service?: string;
  floor?: string;
  /** true のとき永続化せずプレビューのみ */
  dryRun?: boolean;
};

export type DoujinFetchSummary = {
  job: DoujinFetchJob;
  searchTotalCount: number;
  apiReturnedCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  nextOffset: number;
  durationMs: number;
  dryRun?: boolean;
  normalizedPreview?: NormalizedDoujinApiItem[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const match = error.message.match(/DMM API request failed: (\d+)/);
  if (!match) return true;
  const status = Number(match[1]);
  return status === 429 || status >= 500;
}

async function fetchDoujinItemListWithRetry(options: {
  hits: number;
  offset: number;
  keyword?: string;
  sort?: string;
  config: DoujinFloorConfig;
}): Promise<{ items: DmmItem[]; totalCount: number; resultCount: number }> {
  const maxAttempts = Number(process.env.FANZA_SYNC_MAX_RETRIES ?? 3);
  const baseDelayMs = Number(process.env.FANZA_SYNC_RETRY_BASE_MS ?? 500);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchDmmItemList({
        hits: options.hits,
        offset: options.offset,
        keyword: options.keyword,
        sort: options.sort as
          | "rank"
          | "date"
          | "price"
          | "review"
          | "-price"
          | "match"
          | undefined,
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
      if (attempt >= maxAttempts || !isRetryableError(error)) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn("[doujin-fetch] retry", {
        attempt,
        delay,
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Doujin ItemList failed after retries");
}

function validateFetchRequest(input: DoujinFetchRequest): {
  hits: number;
  offset: number;
  keyword?: string;
  sort?: string;
} {
  const hits = Math.min(
    Math.max(1, Math.floor(Number(input.hits) || 1)),
    Math.min(DOUJIN_FETCH_MAX_TOTAL, getDoujinAdminBatchSize()),
  );
  const offset = Math.min(
    Math.max(1, Math.floor(Number(input.offset) || 1)),
    DOUJIN_ITEMLIST_MAX_OFFSET,
  );
  const keyword = input.keyword?.trim() || undefined;
  const sort = input.sort?.trim() || undefined;

  if (keyword && keyword.length > 100) {
    throw new Error("キーワードは100文字以内にしてください");
  }
  if (sort && !/^[a-zA-Z_-]+$/.test(sort)) {
    throw new Error("sort の値が不正です");
  }

  return { hits, offset, keyword, sort };
}

export async function runDoujinFetch(
  input: DoujinFetchRequest,
): Promise<DoujinFetchSummary> {
  const dryRun = Boolean(input.dryRun);
  if (!dryRun) {
    assertDoujinLocalWriteAllowed("doujin-fetch");
  }
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }

  const floorResolved = resolveDoujinFloorConfig({
    site: input.site,
    service: input.service,
    floor: input.floor,
  });
  if (!floorResolved.ok) {
    throw new Error(floorResolved.error);
  }

  const contentId = input.contentId?.trim() || undefined;
  const validated = validateFetchRequest({
    ...input,
    // 作品ID指定時は keyword に載せ、件数1件・offset1で取得
    keyword: contentId || input.keyword,
    hits: contentId ? 1 : input.hits,
    offset: contentId ? 1 : input.offset,
  });
  const { hits, offset, keyword, sort } = validated;
  resetPerfCounters();
  const jobId = `job-${Date.now()}${dryRun ? "-preview" : ""}`;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  let job: DoujinFetchJob = {
    id: jobId,
    status: "running",
    requestedHits: hits,
    offset,
    keyword,
    sort,
    site: floorResolved.config.site,
    service: floorResolved.config.service,
    floor: floorResolved.config.floor,
    apiReturnedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    startedAt,
    stopRequested: false,
  };
  if (!dryRun) {
    saveDoujinFetchJob(job);
  }
  appendDoujinFetchLog({
    level: "info",
    message: dryRun ? "fetch preview started" : "fetch started",
    jobId,
    detail: {
      hits,
      offset,
      keyword,
      contentId,
      sort,
      dryRun,
      site: job.site,
      service: job.service,
      floor: job.floor,
    },
  });

  let remaining = hits;
  let currentOffset = offset;
  let searchTotalCount = 0;
  let apiReturnedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const preview: NormalizedDoujinApiItem[] = [];
  const state = loadDoujinCatalogMutableState();

  try {
    while (remaining > 0) {
      const latest = loadDoujinFetchJob();
      if (!dryRun && latest?.id === jobId && latest.stopRequested) {
        persistDoujinCatalogMutableState(state, {
          revalidatePublicCatalog: true,
        });
        job = {
          ...job,
          status: "stopped",
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedMs,
          searchTotalCount,
          apiReturnedCount,
          createdCount,
          updatedCount,
          duplicateCount,
          skippedCount,
          errorCount,
          nextOffset: currentOffset,
        };
        saveDoujinFetchJob(job);
        appendDoujinFetchLog({
          level: "warn",
          message: "fetch stopped by request",
          jobId,
        });
        return {
          job,
          searchTotalCount,
          apiReturnedCount,
          createdCount,
          updatedCount,
          duplicateCount,
          skippedCount,
          errorCount,
          nextOffset: currentOffset,
          durationMs: job.durationMs ?? 0,
          dryRun,
        };
      }

      const pageHits = Math.min(remaining, DOUJIN_ITEMLIST_MAX_HITS);
      const page = await fetchDoujinItemListWithRetry({
        hits: pageHits,
        offset: currentOffset,
        keyword,
        sort,
        config: floorResolved.config,
      });

      searchTotalCount = page.totalCount;
      apiReturnedCount += page.items.length;

      const normalized: NormalizedDoujinApiItem[] = [];
      for (const raw of page.items) {
        const result = normalizeDoujinApiItem(raw, floorResolved.config);
        if (!result.ok) {
          skippedCount += 1;
          appendDoujinFetchLog({
            level: "warn",
            message: `skip: ${result.reason}`,
            jobId,
            contentId:
              typeof (raw as { content_id?: string }).content_id === "string"
                ? (raw as { content_id: string }).content_id
                : undefined,
          });
          continue;
        }
        normalized.push(result.item);
        if (preview.length < 20) preview.push(result.item);
      }

      const upsert = applyNormalizedDoujinItems(state, normalized, {
        jobId,
        dryRun,
        popularityBaseOffset:
          sort === "rank" || !sort ? currentOffset : undefined,
      });
      createdCount += upsert.created;
      updatedCount += upsert.updated;
      duplicateCount += upsert.duplicate;
      errorCount += upsert.errors;

      remaining -= pageHits;
      currentOffset += page.items.length;

      job = {
        ...job,
        searchTotalCount,
        apiReturnedCount,
        createdCount,
        updatedCount,
        duplicateCount,
        skippedCount,
        errorCount,
        nextOffset: currentOffset,
      };
      if (!dryRun) {
        saveDoujinFetchJob(job);
      }

      if (page.items.length === 0) break;
      await sleep(200);
    }

    const persist = dryRun
      ? { wroteAny: false }
      : persistDoujinCatalogMutableState(state, {
          revalidatePublicCatalog: true,
        });

    const durationMs = Date.now() - startedMs;
    job = {
      ...job,
      status: "completed",
      finishedAt: new Date().toISOString(),
      durationMs,
      searchTotalCount,
      apiReturnedCount,
      createdCount,
      updatedCount,
      duplicateCount,
      skippedCount,
      errorCount,
      nextOffset: currentOffset,
    };
    if (!dryRun) {
      saveDoujinFetchJob(job);
    }
    appendDoujinFetchLog({
      level: "info",
      message: dryRun ? "fetch preview completed" : "fetch completed",
      jobId,
      detail: {
        searchTotalCount,
        apiReturnedCount,
        createdCount,
        updatedCount,
        skippedCount,
        errorCount,
        dryRun,
        persisted: persist.wroteAny,
        perf: getPerfSnapshot().counters,
      },
    });

    return {
      job,
      searchTotalCount,
      apiReturnedCount,
      createdCount,
      updatedCount,
      duplicateCount,
      skippedCount,
      errorCount,
      nextOffset: currentOffset,
      durationMs,
      dryRun,
      normalizedPreview: preview,
    };
  } catch (error) {
    const durationMs = Date.now() - startedMs;
    const message = error instanceof Error ? error.message : String(error);
    job = {
      ...job,
      status: "error",
      finishedAt: new Date().toISOString(),
      durationMs,
      lastError: message,
      searchTotalCount,
      apiReturnedCount,
      createdCount,
      updatedCount,
      duplicateCount,
      skippedCount,
      errorCount: errorCount + 1,
      nextOffset: currentOffset,
    };
    if (!dryRun) {
      saveDoujinFetchJob(job);
    }
    appendDoujinFetchLog({
      level: "error",
      message,
      jobId,
    });
    throw error;
  }
}

export function requestStopDoujinFetch(): DoujinFetchJob | null {
  const job = loadDoujinFetchJob();
  if (!job || job.status !== "running") return job;
  const next = { ...job, stopRequested: true };
  saveDoujinFetchJob(next);
  return next;
}

/** 診断用: 生JSONと正規化結果を返す（DB保存なし） */
export async function diagnoseDoujinItem(input: {
  site?: string;
  service?: string;
  floor?: string;
  keyword?: string;
  sort?: string;
  offset?: number;
}): Promise<{
  floor: DoujinFloorConfig;
  searchTotalCount: number;
  apiReturnedCount: number;
  rawItem: Record<string, unknown> | null;
  normalized: NormalizedDoujinApiItem | null;
  iteminfoKeys: string[];
  authorLikeKeys: string[];
}> {
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }

  const floorResolved = resolveDoujinFloorConfig(input);
  if (!floorResolved.ok) {
    throw new Error(floorResolved.error);
  }

  const page = await fetchDoujinItemListWithRetry({
    hits: 1,
    offset: Math.max(1, Math.floor(Number(input.offset) || 1)),
    keyword: input.keyword?.trim() || undefined,
    sort: input.sort?.trim() || "rank",
    config: floorResolved.config,
  });

  const raw = page.items[0] as unknown as Record<string, unknown> | undefined;
  const normalizedResult = raw
    ? normalizeDoujinApiItem(raw, floorResolved.config)
    : null;

  const iteminfo =
    raw && typeof raw.iteminfo === "object" && raw.iteminfo
      ? (raw.iteminfo as Record<string, unknown>)
      : {};
  const iteminfoKeys = Object.keys(iteminfo);
  const authorLikeKeys = [
    ...iteminfoKeys,
    ...Object.keys(raw ?? {}),
  ].filter((key) =>
    /^(authors?|writers?|creators?|artists?|illustrators?|著者|作家|作者|原画家?|シナリオ)$/i.test(key),
  );

  const displayRaw = raw
    ? (JSON.parse(
        JSON.stringify(raw).replace(
          /(api_id|affiliate_id)=[^&"]+/gi,
          "$1=REDACTED",
        ),
      ) as Record<string, unknown>)
    : null;

  return {
    floor: floorResolved.config,
    searchTotalCount: page.totalCount,
    apiReturnedCount: page.resultCount,
    rawItem: displayRaw,
    normalized:
      normalizedResult && normalizedResult.ok ? normalizedResult.item : null,
    iteminfoKeys,
    authorLikeKeys: [...new Set(authorLikeKeys)],
  };
}
