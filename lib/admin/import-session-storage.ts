import type {
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
  ImportFetchSort,
} from "@/lib/admin/import-simple-types";

export const IMPORT_OFFSETS_STORAGE_KEY = "adult-import-offsets.json";
/** @deprecated 個別キー。新形式へ移行 */
export const IMPORT_OFFSET_STORAGE_PREFIX = "adult-zukan-import-next-offset-";
export const IMPORT_CANDIDATES_SESSION_KEY = "adult-zukan-import-candidates-session";
export const IMPORT_SUMMARY_SESSION_KEY = "adult-zukan-import-summary-session";

export type ImportOffsetsMap = {
  popular: number;
  new: number;
};

export type ImportCandidatesSession = {
  sort: ImportFetchSort;
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary | null;
};

function readOffsetsMap(): ImportOffsetsMap {
  const empty: ImportOffsetsMap = { popular: 0, new: 0 };
  if (typeof window === "undefined") return empty;

  try {
    const raw = window.localStorage.getItem(IMPORT_OFFSETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ImportOffsetsMap>;
      return {
        popular:
          typeof parsed.popular === "number" && parsed.popular >= 0
            ? Math.floor(parsed.popular)
            : 0,
        new:
          typeof parsed.new === "number" && parsed.new >= 0
            ? Math.floor(parsed.new)
            : 0,
      };
    }

    // 旧キーからの移行
    const popularLegacy = window.localStorage.getItem(
      `${IMPORT_OFFSET_STORAGE_PREFIX}popular`,
    );
    const newLegacy = window.localStorage.getItem(
      `${IMPORT_OFFSET_STORAGE_PREFIX}new`,
    );
    const migrated: ImportOffsetsMap = {
      popular: popularLegacy
        ? Math.max(0, Math.floor(Number(popularLegacy)) || 0)
        : 0,
      new: newLegacy ? Math.max(0, Math.floor(Number(newLegacy)) || 0) : 0,
    };
    writeOffsetsMap(migrated);
    return migrated;
  } catch {
    return empty;
  }
}

function writeOffsetsMap(map: ImportOffsetsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      IMPORT_OFFSETS_STORAGE_KEY,
      JSON.stringify({
        popular: Math.max(0, Math.floor(map.popular)),
        new: Math.max(0, Math.floor(map.new)),
      }),
    );
  } catch {
    // ignore quota errors
  }
}

export function readStoredOffset(sort: ImportFetchSort): number | null {
  const map = readOffsetsMap();
  const value = map[sort];
  return Number.isFinite(value) ? value : null;
}

export function writeStoredOffset(sort: ImportFetchSort, offset: number): void {
  const map = readOffsetsMap();
  map[sort] = Math.max(0, Math.floor(offset));
  writeOffsetsMap(map);
}

export function readCandidatesSession(): ImportCandidatesSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(IMPORT_CANDIDATES_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportCandidatesSession;
    if (!Array.isArray(parsed.candidates)) return null;
    if (parsed.sort !== "popular" && parsed.sort !== "new") {
      parsed.sort = "popular";
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
