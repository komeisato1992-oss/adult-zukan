import type {
  CatalogRefreshBatchSummary,
  CatalogRefreshState,
} from "@/lib/dmm/catalog-refresh-types";
import { CATALOG_REFRESH_DEFAULT_BATCH_SIZE } from "@/lib/admin/catalog-refresh-constants";

export function createDefaultCatalogRefreshState(): CatalogRefreshState {
  return {
    nextRefreshOffset: 0,
    batchSize: CATALOG_REFRESH_DEFAULT_BATCH_SIZE,
    lastCompletedAt: null,
    cycleCount: 0,
    lastBatchSummary: null,
  };
}

export function parseCatalogRefreshState(raw: unknown): CatalogRefreshState {
  const defaults = createDefaultCatalogRefreshState();

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const record = raw as Partial<CatalogRefreshState>;

  return {
    nextRefreshOffset:
      typeof record.nextRefreshOffset === "number" &&
      Number.isFinite(record.nextRefreshOffset) &&
      record.nextRefreshOffset >= 0
        ? Math.floor(record.nextRefreshOffset)
        : defaults.nextRefreshOffset,
    batchSize:
      typeof record.batchSize === "number" &&
      Number.isFinite(record.batchSize) &&
      record.batchSize >= 1
        ? Math.floor(record.batchSize)
        : defaults.batchSize,
    lastCompletedAt:
      typeof record.lastCompletedAt === "string"
        ? record.lastCompletedAt
        : defaults.lastCompletedAt,
    cycleCount:
      typeof record.cycleCount === "number" &&
      Number.isFinite(record.cycleCount) &&
      record.cycleCount >= 0
        ? Math.floor(record.cycleCount)
        : defaults.cycleCount,
    lastBatchSummary: parseBatchSummary(record.lastBatchSummary),
  };
}

function parseBatchSummary(
  raw: unknown,
): CatalogRefreshBatchSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Partial<CatalogRefreshBatchSummary>;

  if (typeof record.targetCount !== "number") return null;

  return {
    targetCount: record.targetCount,
    updatedCount: record.updatedCount ?? 0,
    unchangedCount: record.unchangedCount ?? 0,
    unavailableCount: record.unavailableCount ?? 0,
    failedCount: record.failedCount ?? 0,
    priceChangedCount: record.priceChangedCount ?? 0,
    saleStartedCount: record.saleStartedCount ?? 0,
    saleEndedCount: record.saleEndedCount ?? 0,
    availabilityChangedCount: record.availabilityChangedCount ?? 0,
    nextRefreshOffset: record.nextRefreshOffset ?? 0,
    cycleCount: record.cycleCount ?? 0,
    elapsedMs: record.elapsedMs ?? 0,
    failures: Array.isArray(record.failures)
      ? record.failures.filter(
          (entry): entry is { contentId: string; reason: string } =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as { contentId?: string }).contentId === "string" &&
            typeof (entry as { reason?: string }).reason === "string",
        )
      : [],
  };
}

export function serializeCatalogRefreshState(
  state: CatalogRefreshState,
): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function buildRefreshResultMessage(
  summary: CatalogRefreshBatchSummary,
): string {
  return [
    `更新対象：${summary.targetCount}件`,
    `更新成功：${summary.updatedCount}件`,
    `価格変更：${summary.priceChangedCount}件`,
    `セール開始：${summary.saleStartedCount}件`,
    `セール終了：${summary.saleEndedCount}件`,
    `販売状態変更：${summary.availabilityChangedCount}件`,
    `変更なし：${summary.unchangedCount}件`,
    `取得不可：${summary.unavailableCount}件`,
    `取得失敗：${summary.failedCount}件`,
    `次回開始位置：${summary.nextRefreshOffset.toLocaleString()}`,
  ].join("\n");
}
