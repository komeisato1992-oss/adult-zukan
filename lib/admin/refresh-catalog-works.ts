import "server-only";

import {
  CATALOG_REFRESH_COMMIT_MAX_RETRIES,
  CATALOG_REFRESH_FETCH_CONCURRENCY,
  CATALOG_REFRESH_MAX_BATCH_SIZE,
} from "@/lib/admin/catalog-refresh-constants";
import { selectRefreshBatch } from "@/lib/admin/catalog-refresh-priority";
import {
  buildRefreshResultMessage,
  createDefaultCatalogRefreshState,
} from "@/lib/admin/catalog-refresh-state";
import {
  loadCatalogRefreshState,
  persistCatalogRefreshStateLocally,
  serializeCatalogRefreshStateFile,
} from "@/lib/admin/github-catalog-refresh-state";
import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
  GitHubCatalogError,
  type CatalogSnapshotHandle,
} from "@/lib/admin/github-catalog";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  mergeRefreshedWork,
  markWorkFetchFailed,
  markWorkUnavailable,
} from "@/lib/dmm/catalog-refresh-fields";
import type {
  CatalogRefreshBatchSummary,
  CatalogRefreshState,
  CatalogRefreshStrategy,
} from "@/lib/dmm/catalog-refresh-types";
import { normalizeCatalogContentId, readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { fetchDmmItemByContentId, isDmmConfigured } from "@/lib/dmm/client";
import {
  IndexRebuildError,
  rebuildAllIndexes,
  serializeCatalogIndexes,
} from "@/lib/dmm/index-builders";
import type { DmmItem } from "@/lib/dmm/types";

export class RefreshCatalogWorksError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RefreshCatalogWorksError";
    this.status = status;
  }
}

export type RefreshCatalogWorksInput = {
  batchSize?: number;
  offset?: number;
  strategy?: Partial<CatalogRefreshStrategy>;
  dryRun?: boolean;
};

export type RefreshCatalogWorksResult = {
  summary: CatalogRefreshBatchSummary;
  state: CatalogRefreshState;
  message: string;
  committedToGitHub: boolean;
};

const DEFAULT_STRATEGY: CatalogRefreshStrategy = {
  prioritizeSale: true,
  prioritizeStale: true,
  prioritizePopular: true,
};

function resolveStrategy(
  partial?: Partial<CatalogRefreshStrategy>,
): CatalogRefreshStrategy {
  return {
    prioritizeSale: partial?.prioritizeSale ?? DEFAULT_STRATEGY.prioritizeSale,
    prioritizeStale:
      partial?.prioritizeStale ?? DEFAULT_STRATEGY.prioritizeStale,
    prioritizePopular:
      partial?.prioritizePopular ?? DEFAULT_STRATEGY.prioritizePopular,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

async function loadCatalogForRefresh(): Promise<CatalogSnapshotHandle> {
  if (isGitHubCatalogConfigured()) {
    try {
      return await fetchCatalogFromGitHub();
    } catch (error) {
      console.warn(
        "[catalog-refresh] GitHub catalog read failed; falling back to local snapshot",
        error,
      );
    }
  }

  const items = readCatalogSnapshot();
  return {
    items,
    sha: null,
    envelope: { format: "array" },
    raw: items,
    rebuilt: false,
  };
}

async function fetchApiWork(contentId: string): Promise<DmmItem | null> {
  const response = await fetchDmmItemByContentId(contentId);
  const item = response.result.items?.[0];
  return item ?? null;
}

type ProcessedRefreshResult = {
  status: "updated" | "unchanged" | "unavailable" | "failed";
  contentId: string;
  work: DmmItem;
  reason?: string;
  priceChanged: boolean;
  saleStarted: boolean;
  saleEnded: boolean;
  availabilityChanged: boolean;
};

function applyRefreshResults(
  catalogItems: DmmItem[],
  results: ProcessedRefreshResult[],
): DmmItem[] {
  const byId = new Map<string, number>();

  for (let index = 0; index < catalogItems.length; index += 1) {
    byId.set(normalizeCatalogContentId(catalogItems[index].content_id), index);
  }

  const nextItems = [...catalogItems];

  for (const result of results) {
    const normalizedId = normalizeCatalogContentId(result.contentId);
    const index = byId.get(normalizedId);
    if (index == null) continue;
    nextItems[index] = result.work;
  }

  return nextItems;
}

async function refreshSingleWork(existing: DmmItem): Promise<ProcessedRefreshResult> {
  const contentId = existing.content_id;

  try {
    const apiItem = await fetchApiWork(contentId);

    if (!apiItem) {
      const { work, availabilityChanged } = markWorkUnavailable(
        existing,
        "APIに作品が見つかりませんでした",
      );

      return {
        status: "unavailable",
        contentId,
        reason: "APIに作品が見つかりませんでした",
        work,
        priceChanged: false,
        saleStarted: false,
        saleEnded: false,
        availabilityChanged,
      };
    }

    const merged = mergeRefreshedWork(existing, apiItem);

    if (!merged.changed) {
      return {
        status: "unchanged",
        contentId,
        work: merged.work,
        priceChanged: false,
        saleStarted: false,
        saleEnded: false,
        availabilityChanged: false,
      };
    }

    return {
      status: "updated",
      contentId,
      work: merged.work,
      priceChanged: merged.priceChanged,
      saleStarted: merged.saleStarted,
      saleEnded: merged.saleEnded,
      availabilityChanged: merged.availabilityChanged,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "作品の再取得に失敗しました";

    return {
      status: "failed",
      contentId,
      reason,
      work: markWorkFetchFailed(existing),
      priceChanged: false,
      saleStarted: false,
      saleEnded: false,
      availabilityChanged: false,
    };
  }
}

function summarizeResults(
  targetCount: number,
  results: ProcessedRefreshResult[],
  nextRefreshOffset: number,
  cycleCount: number,
  elapsedMs: number,
): CatalogRefreshBatchSummary {
  let updatedCount = 0;
  let unchangedCount = 0;
  let unavailableCount = 0;
  let failedCount = 0;
  let priceChangedCount = 0;
  let saleStartedCount = 0;
  let saleEndedCount = 0;
  let availabilityChangedCount = 0;
  const failures: Array<{ contentId: string; reason: string }> = [];

  for (const result of results) {
    switch (result.status) {
      case "updated":
        updatedCount += 1;
        if (result.priceChanged) priceChangedCount += 1;
        if (result.saleStarted) saleStartedCount += 1;
        if (result.saleEnded) saleEndedCount += 1;
        if (result.availabilityChanged) availabilityChangedCount += 1;
        break;
      case "unchanged":
        unchangedCount += 1;
        break;
      case "unavailable":
        unavailableCount += 1;
        if (result.availabilityChanged) availabilityChangedCount += 1;
        break;
      case "failed":
        failedCount += 1;
        failures.push({
          contentId: result.contentId,
          reason: result.reason ?? "取得失敗",
        });
        break;
      default:
        break;
    }
  }

  return {
    targetCount,
    updatedCount,
    unchangedCount,
    unavailableCount,
    failedCount,
    priceChangedCount,
    saleStartedCount,
    saleEndedCount,
    availabilityChangedCount,
    nextRefreshOffset,
    cycleCount,
    elapsedMs,
    failures,
  };
}

export async function refreshCatalogWorks(
  input: RefreshCatalogWorksInput = {},
): Promise<RefreshCatalogWorksResult> {
  if (!isDmmConfigured()) {
    throw new RefreshCatalogWorksError(
      "FANZA API の設定が未完了です。",
      503,
    );
  }

  const startedAt = Date.now();
  const strategy = resolveStrategy(input.strategy);
  const storedState = await loadCatalogRefreshState();
  const batchSize = Math.min(
    Math.max(1, Math.floor(input.batchSize ?? storedState.batchSize)),
    CATALOG_REFRESH_MAX_BATCH_SIZE,
  );
  const offset = Math.max(
    0,
    Math.floor(input.offset ?? storedState.nextRefreshOffset),
  );

  console.log("[catalog-refresh] start", {
    batchSize,
    offset,
    strategy,
    dryRun: Boolean(input.dryRun),
  });

  let retryCount = 0;
  let committedToGitHub = false;
  let summary!: CatalogRefreshBatchSummary;
  let nextState!: CatalogRefreshState;

  while (retryCount <= CATALOG_REFRESH_COMMIT_MAX_RETRIES) {
    console.time("[catalog-refresh] fetch-catalog");
    const { items, envelope, raw } = await loadCatalogForRefresh();
    console.timeEnd("[catalog-refresh] fetch-catalog");

    const selection = selectRefreshBatch(items, offset, batchSize, strategy);
    const batch = selection.batch;

    console.log("[catalog-refresh] batch selected", {
      catalogCount: selection.catalogCount,
      batchCount: batch.length,
      offset,
      nextOffset: selection.nextOffset,
      cycled: selection.cycled,
    });

    if (batch.length === 0) {
      summary = summarizeResults(
        0,
        [],
        selection.nextOffset,
        storedState.cycleCount,
        Date.now() - startedAt,
      );
      nextState = {
        ...storedState,
        batchSize,
        lastCompletedAt: new Date().toISOString(),
        lastBatchSummary: summary,
      };
      break;
    }

    console.time("[catalog-refresh] fetch-api");
    const processed = await mapWithConcurrency(
      batch,
      CATALOG_REFRESH_FETCH_CONCURRENCY,
      refreshSingleWork,
    );
    console.timeEnd("[catalog-refresh] fetch-api");

    const mergedItems = applyRefreshResults(items, processed);
    const cycleCount =
      selection.cycled ? storedState.cycleCount + 1 : storedState.cycleCount;

    summary = summarizeResults(
      batch.length,
      processed,
      selection.nextOffset,
      cycleCount,
      Date.now() - startedAt,
    );

    nextState = {
      nextRefreshOffset: selection.nextOffset,
      batchSize,
      lastCompletedAt: new Date().toISOString(),
      cycleCount,
      lastBatchSummary: summary,
    };

    if (input.dryRun) {
      console.log("[catalog-refresh] dry-run complete", summary);
      persistCatalogRefreshStateLocally(nextState);
      return {
        summary,
        state: nextState,
        message: buildRefreshResultMessage(summary),
        committedToGitHub: false,
      };
    }

    if (!isGitHubCatalogConfigured()) {
      throw new RefreshCatalogWorksError(
        "GitHub連携の設定が未完了です。本番更新には GitHub 設定が必要です。",
        503,
      );
    }

    try {
      console.time("[catalog-refresh] rebuild-indexes");
      const nextIndexes = rebuildAllIndexes(mergedItems);
      console.timeEnd("[catalog-refresh] rebuild-indexes");

      const indexFiles = [
        ...serializeCatalogIndexes(nextIndexes),
        serializeCatalogRefreshStateFile(nextState),
      ];

      console.time("[catalog-refresh] github-commit");
      await commitCatalogBundleToGitHub(
        envelope,
        mergedItems,
        `Refresh ${summary.updatedCount} catalog works`,
        indexFiles,
        raw,
      );
      console.timeEnd("[catalog-refresh] github-commit");

      committedToGitHub = true;
      persistCatalogRefreshStateLocally(nextState);
      break;
    } catch (error) {
      if (
        error instanceof GitHubCatalogError &&
        (error.status === 409 || error.status === 422) &&
        retryCount < CATALOG_REFRESH_COMMIT_MAX_RETRIES
      ) {
        retryCount += 1;
        console.warn("[catalog-refresh] retry after github conflict", {
          retryCount,
          status: error.status,
        });
        continue;
      }

      if (error instanceof IndexRebuildError) {
        throw new RefreshCatalogWorksError(error.message, 500);
      }

      if (error instanceof GitHubCatalogError) {
        throw new RefreshCatalogWorksError(
          error.githubMessage ??
            "GitHubへのカタログ保存に失敗しました。更新は確定していません。",
          error.status,
        );
      }

      throw error;
    }
  }

  if (!summary) {
    summary = summarizeResults(
      0,
      [],
      storedState.nextRefreshOffset,
      storedState.cycleCount,
      Date.now() - startedAt,
    );
    nextState = createDefaultCatalogRefreshState();
  }

  return {
    summary,
    state: nextState,
    message: buildRefreshResultMessage(summary),
    committedToGitHub,
  };
}

export function parseRefreshCatalogWorksRequest(body: unknown): RefreshCatalogWorksInput {
  if (!body || typeof body !== "object") {
    return {};
  }

  const record = body as Record<string, unknown>;

  return {
    batchSize:
      record.batchSize == null ? undefined : Number(record.batchSize),
    offset: record.offset == null ? undefined : Number(record.offset),
    dryRun: record.dryRun === true,
    strategy: {
      prioritizeSale: record.prioritizeSale !== false,
      prioritizeStale: record.prioritizeStale !== false,
      prioritizePopular: record.prioritizePopular !== false,
    },
  };
}
