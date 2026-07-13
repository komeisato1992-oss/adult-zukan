import type {
  AdultImportSortMode,
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import { isAdultImportSortMode } from "@/lib/admin/import-simple-types";

export const IMPORT_OFFSETS_STORAGE_KEY = "adult-import-offsets.json";
export const IMPORT_SORT_STORAGE_KEY = "adult-import-sort-mode";
/** @deprecated 個別キー。新形式へ移行 */
export const IMPORT_OFFSET_STORAGE_PREFIX = "adult-zukan-import-next-offset-";
export const IMPORT_CANDIDATES_SESSION_KEY = "adult-zukan-import-candidates-session";
export const IMPORT_SUMMARY_SESSION_KEY = "adult-zukan-import-summary-session";

export type ImportOffsetModeState = {
  currentOffset: number;
  previousOffset: number;
};

export type ImportOffsetsDocument = {
  popular: ImportOffsetModeState;
  new: ImportOffsetModeState;
};

export type ImportCandidatesSession = {
  sort: AdultImportSortMode;
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary | null;
};

function emptyOffsetsDocument(): ImportOffsetsDocument {
  return {
    popular: { currentOffset: 0, previousOffset: 0 },
    new: { currentOffset: 0, previousOffset: 0 },
  };
}

function normalizeModeState(raw: unknown): ImportOffsetModeState {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    const offset = Math.floor(raw);
    return { currentOffset: offset, previousOffset: 0 };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<ImportOffsetModeState>;
    const current =
      typeof obj.currentOffset === "number" && obj.currentOffset >= 0
        ? Math.floor(obj.currentOffset)
        : 0;
    const previous =
      typeof obj.previousOffset === "number" && obj.previousOffset >= 0
        ? Math.floor(obj.previousOffset)
        : 0;
    return { currentOffset: current, previousOffset: previous };
  }
  return { currentOffset: 0, previousOffset: 0 };
}

function readOffsetsDocument(): ImportOffsetsDocument {
  const empty = emptyOffsetsDocument();
  if (typeof window === "undefined") return empty;

  try {
    const raw = window.localStorage.getItem(IMPORT_OFFSETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ImportOffsetsDocument> & {
        popular?: unknown;
        new?: unknown;
      };
      return {
        popular: normalizeModeState(parsed.popular),
        new: normalizeModeState(parsed.new),
      };
    }

    // 旧キーからの移行
    const popularLegacy = window.localStorage.getItem(
      `${IMPORT_OFFSET_STORAGE_PREFIX}popular`,
    );
    const newLegacy = window.localStorage.getItem(
      `${IMPORT_OFFSET_STORAGE_PREFIX}new`,
    );
    const migrated: ImportOffsetsDocument = {
      popular: {
        currentOffset: popularLegacy
          ? Math.max(0, Math.floor(Number(popularLegacy)) || 0)
          : 0,
        previousOffset: 0,
      },
      new: {
        currentOffset: newLegacy
          ? Math.max(0, Math.floor(Number(newLegacy)) || 0)
          : 0,
        previousOffset: 0,
      },
    };
    writeOffsetsDocument(migrated);
    return migrated;
  } catch {
    return empty;
  }
}

function writeOffsetsDocument(doc: ImportOffsetsDocument): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      IMPORT_OFFSETS_STORAGE_KEY,
      JSON.stringify({
        popular: {
          currentOffset: Math.max(0, Math.floor(doc.popular.currentOffset)),
          previousOffset: Math.max(0, Math.floor(doc.popular.previousOffset)),
        },
        new: {
          currentOffset: Math.max(0, Math.floor(doc.new.currentOffset)),
          previousOffset: Math.max(0, Math.floor(doc.new.previousOffset)),
        },
      }),
    );
  } catch {
    // ignore quota errors
  }
}

export function readStoredOffset(sort: AdultImportSortMode): number | null {
  const doc = readOffsetsDocument();
  return doc[sort].currentOffset;
}

export function readStoredPreviousOffset(
  sort: AdultImportSortMode,
): number | null {
  const doc = readOffsetsDocument();
  return doc[sort].previousOffset;
}

export function writeStoredOffset(
  sort: AdultImportSortMode,
  offset: number,
  options?: { previousOffset?: number },
): void {
  const doc = readOffsetsDocument();
  const nextCurrent = Math.max(0, Math.floor(offset));
  doc[sort] = {
    currentOffset: nextCurrent,
    previousOffset:
      options?.previousOffset != null
        ? Math.max(0, Math.floor(options.previousOffset))
        : doc[sort].previousOffset,
  };
  writeOffsetsDocument(doc);
}

export function readStoredSortMode(): AdultImportSortMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMPORT_SORT_STORAGE_KEY);
    return isAdultImportSortMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredSortMode(sort: AdultImportSortMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_SORT_STORAGE_KEY, sort);
  } catch {
    // ignore
  }
}

export function readCandidatesSession(): ImportCandidatesSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(IMPORT_CANDIDATES_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportCandidatesSession;
    if (!Array.isArray(parsed.candidates)) return null;
    if (!isAdultImportSortMode(parsed.sort)) {
      parsed.sort = "popular";
    }
    if (parsed.summary && !isAdultImportSortMode(parsed.summary.sort)) {
      parsed.summary = { ...parsed.summary, sort: parsed.sort };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCandidatesSession(session: ImportCandidatesSession): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      IMPORT_CANDIDATES_SESSION_KEY,
      JSON.stringify(session),
    );
  } catch (error) {
    console.warn("[import-session] failed to persist candidates", error);
  }
}

export function clearCandidatesSession(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(IMPORT_CANDIDATES_SESSION_KEY);
    window.sessionStorage.removeItem(IMPORT_SUMMARY_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getCandidateSelectionId(
  candidate: FetchedImportCandidate,
): string {
  return candidate.contentId || candidate.item.content_id;
}
