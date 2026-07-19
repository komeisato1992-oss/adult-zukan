import type { FanzaExpandSourceId } from "@/lib/admin/fanza-expand-shared";

export type FanzaExpandSource = FanzaExpandSourceId;

export type FanzaExpandJobStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type FanzaExpandSourceStats = {
  apiFetchedCount: number;
  newAddedCount: number;
  updatedCount: number;
  duplicateCount: number;
  noImageExcludedCount: number;
  errorCount: number;
  lastOffset: number;
  lastEntityIndex: number;
  lastEntityName: string | null;
  lastFetchAt: string | null;
};

export type FanzaExpandCursor = {
  source: FanzaExpandSource;
  /** 人気順・新着順、またはキーワード内ページの offset（1-based） */
  offset: number;
  /** キーワードソース用: エンティティ配列の位置 */
  entityIndex: number;
  entityName: string | null;
};

export type FanzaExpandJob = {
  id: string;
  status: FanzaExpandJobStatus;
  targetCount: number;
  currentWorkCount: number;
  remainingCount: number;
  sourceOrder: FanzaExpandSource[];
  cursor: FanzaExpandCursor;
  batchSize: number;
  upsertChunkSize: number;
  requestDelayMs: number;
  maxRetries: number;
  dryRun: boolean;
  apiFetchedCount: number;
  newAddedCount: number;
  updatedCount: number;
  duplicateCount: number;
  noImageExcludedCount: number;
  errorCount: number;
  batchesProcessed: number;
  consecutiveEmptyBatches: number;
  consecutiveErrors: number;
  sourceStats: Record<FanzaExpandSource, FanzaExpandSourceStats>;
  pauseRequested?: boolean;
  stopRequested?: boolean;
  stopReason?: string;
  lastError?: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  lastFetchAt?: string;
  pausedAt?: string;
};

export type FanzaExpandOverview = {
  job: FanzaExpandJob | null;
  currentWorkCount: number;
  targetCount: number;
  remainingCount: number;
  running: boolean;
  writeAllowed: boolean;
  localCliCommand: string;
  notice: string;
};

export function emptySourceStats(): FanzaExpandSourceStats {
  return {
    apiFetchedCount: 0,
    newAddedCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    noImageExcludedCount: 0,
    errorCount: 0,
    lastOffset: 1,
    lastEntityIndex: 0,
    lastEntityName: null,
    lastFetchAt: null,
  };
}

export function createEmptySourceStatsMap(
  sources: readonly FanzaExpandSource[],
): Record<FanzaExpandSource, FanzaExpandSourceStats> {
  const map = {} as Record<FanzaExpandSource, FanzaExpandSourceStats>;
  for (const source of sources) {
    map[source] = emptySourceStats();
  }
  return map;
}
