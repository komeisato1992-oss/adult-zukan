import type {
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import type { ImportFetchSort } from "@/lib/admin/import-simple-types";

export const IMPORT_OFFSET_STORAGE_PREFIX = "adult-zukan-import-next-offset-";
export const IMPORT_CANDIDATES_SESSION_KEY = "adult-zukan-import-candidates-session";
export const IMPORT_SUMMARY_SESSION_KEY = "adult-zukan-import-summary-session";

export type ImportCandidatesSession = {
  sort: ImportFetchSort;
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary | null;
};

export function getOffsetStorageKey(sort: ImportFetchSort): string {
  return `${IMPORT_OFFSET_STORAGE_PREFIX}${sort}`;
}

export function readStoredOffset(sort: ImportFetchSort): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getOffsetStorageKey(sort));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  } catch {
    return null;
  }
}

export function writeStoredOffset(sort: ImportFetchSort, offset: number): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getOffsetStorageKey(sort),
      String(Math.max(0, Math.floor(offset))),
    );
  } catch {
    // ignore quota errors
  }
}

export function readCandidatesSession(): ImportCandidatesSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(IMPORT_CANDIDATES_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportCandidatesSession;
    if (!Array.isArray(parsed.candidates)) return null;
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
