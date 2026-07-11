import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";

export type ImportCollectionState = {
  pastOffset: number;
  /** 直前の過去作品収集で使用した開始 offset（「前回に戻す」用） */
  lastPastStartOffset: number | null;
  pageSize: number;
  lastCollectedAt: string | null;
  lastNewCollectedAt: string | null;
  lastPastCollectedAt: string | null;
  lastMode: ImportCollectionMode | null;
  cycleCount: number;
};

export function createDefaultImportCollectionState(
  pageSize: number,
): ImportCollectionState {
  return {
    pastOffset: 1,
    lastPastStartOffset: null,
    pageSize,
    lastCollectedAt: null,
    lastNewCollectedAt: null,
    lastPastCollectedAt: null,
    lastMode: null,
    cycleCount: 0,
  };
}

export function parseImportCollectionState(
  raw: unknown,
  pageSize: number,
): ImportCollectionState {
  const defaults = createDefaultImportCollectionState(pageSize);

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const value = raw as Record<string, unknown>;

  return {
    pastOffset:
      typeof value.pastOffset === "number" && value.pastOffset >= 1
        ? Math.floor(value.pastOffset)
        : defaults.pastOffset,
    lastPastStartOffset:
      typeof value.lastPastStartOffset === "number" &&
      value.lastPastStartOffset >= 1
        ? Math.floor(value.lastPastStartOffset)
        : defaults.lastPastStartOffset,
    pageSize:
      typeof value.pageSize === "number" && value.pageSize >= 1
        ? Math.floor(value.pageSize)
        : pageSize,
    lastCollectedAt:
      typeof value.lastCollectedAt === "string" ? value.lastCollectedAt : null,
    lastNewCollectedAt:
      typeof value.lastNewCollectedAt === "string"
        ? value.lastNewCollectedAt
        : null,
    lastPastCollectedAt:
      typeof value.lastPastCollectedAt === "string"
        ? value.lastPastCollectedAt
        : null,
    lastMode:
      value.lastMode === "new" || value.lastMode === "past"
        ? value.lastMode
        : null,
    cycleCount:
      typeof value.cycleCount === "number" && value.cycleCount >= 0
        ? Math.floor(value.cycleCount)
        : 0,
  };
}

export function serializeImportCollectionState(
  state: ImportCollectionState,
): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}
