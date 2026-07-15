import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const WORKS_ADD_OFFSET_RELATIVE_PATH =
  "data/dmm/works-add-offsets.json";

export type WorksAddSortKey = "new" | "popular";

export type WorksAddOffsetState = {
  version: 1;
  updatedAt: string | null;
  bySort: {
    new: WorksAddSortOffset;
    popular: WorksAddSortOffset;
  };
};

export type WorksAddSortOffset = {
  lastOffset: number;
  lastFetchedAt: string | null;
  lastAddedCid: string | null;
  consecutiveZeroNewCount: number;
  lastAddedCount: number;
  lastDuplicateCount: number;
  lastErrorCount: number;
};

function emptySortOffset(): WorksAddSortOffset {
  return {
    lastOffset: 0,
    lastFetchedAt: null,
    lastAddedCid: null,
    consecutiveZeroNewCount: 0,
    lastAddedCount: 0,
    lastDuplicateCount: 0,
    lastErrorCount: 0,
  };
}

function emptyState(): WorksAddOffsetState {
  return {
    version: 1,
    updatedAt: null,
    bySort: {
      new: emptySortOffset(),
      popular: emptySortOffset(),
    },
  };
}

function absolutePath(): string {
  return path.join(process.cwd(), WORKS_ADD_OFFSET_RELATIVE_PATH);
}

export function readWorksAddOffsetState(): WorksAddOffsetState {
  const filePath = absolutePath();
  if (!existsSync(filePath)) return emptyState();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<WorksAddOffsetState>;
    return {
      version: 1,
      updatedAt: raw.updatedAt ?? null,
      bySort: {
        new: { ...emptySortOffset(), ...(raw.bySort?.new ?? (raw.bySort as { date?: WorksAddSortOffset } | undefined)?.date ?? {}) },
        popular: { ...emptySortOffset(), ...(raw.bySort?.popular ?? {}) },
      },
    };
  } catch {
    return emptyState();
  }
}

export function writeWorksAddOffsetState(state: WorksAddOffsetState): void {
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(
      absolutePath(),
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // read-only FS
  }
}

export function recordWorksAddOffset(input: {
  sort: WorksAddSortKey;
  offset: number;
  addedCount: number;
  duplicateCount: number;
  errorCount: number;
  lastAddedCid?: string | null;
}): WorksAddOffsetState {
  const state = readWorksAddOffsetState();
  const current = state.bySort[input.sort];
  const zeroNew = input.addedCount <= 0;
  const next: WorksAddSortOffset = {
    lastOffset: Math.max(0, Math.floor(input.offset)),
    lastFetchedAt: new Date().toISOString(),
    lastAddedCid: input.lastAddedCid ?? current.lastAddedCid,
    consecutiveZeroNewCount: zeroNew
      ? current.consecutiveZeroNewCount + 1
      : 0,
    lastAddedCount: input.addedCount,
    lastDuplicateCount: input.duplicateCount,
    lastErrorCount: input.errorCount,
  };
  state.bySort[input.sort] = next;
  state.updatedAt = next.lastFetchedAt;
  writeWorksAddOffsetState(state);
  return state;
}
