import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  commitImportCandidatesToGitHub,
  fetchImportCandidatesFromGitHub,
  fetchImportCandidatesRawFromGitHub,
  GitHubImportCandidatesError,
} from "@/lib/admin/github-import-candidates";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import {
  ImportCandidatesJsonError,
  parseImportCandidatesJson,
  serializeImportCandidates,
} from "@/lib/admin/import-candidates-json";
import type {
  ImportCandidateStatus,
  StoredImportCandidate,
} from "@/lib/admin/import-candidate-types";
import { IMPORT_CANDIDATES_RELATIVE_PATH } from "@/lib/admin/import-candidates-path";
import { assertLocalProjectDataWriteAllowed } from "@/lib/admin/runtime-fs";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "dmm");
const IMPORT_CANDIDATES_FILE = path.join(
  process.cwd(),
  IMPORT_CANDIDATES_RELATIVE_PATH,
);

export function readImportCandidatesLocal(): StoredImportCandidate[] {
  if (!existsSync(IMPORT_CANDIDATES_FILE)) {
    return [];
  }

  try {
    return parseImportCandidatesJson(
      readFileSync(IMPORT_CANDIDATES_FILE, "utf-8"),
    );
  } catch (error) {
    if (error instanceof ImportCandidatesJsonError) {
      throw error;
    }
    return [];
  }
}

export function writeImportCandidatesLocal(
  records: StoredImportCandidate[],
): void {
  assertLocalProjectDataWriteAllowed("import-candidates");
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(IMPORT_CANDIDATES_FILE, serializeImportCandidates(records), "utf-8");
}

export async function loadImportCandidates(): Promise<{
  records: StoredImportCandidate[];
  sha: string | null;
}> {
  if (isGitHubCatalogConfigured()) {
    return fetchImportCandidatesFromGitHub();
  }

  return {
    records: readImportCandidatesLocal(),
    sha: null,
  };
}

export async function saveImportCandidates(
  records: StoredImportCandidate[],
  message: string,
  sha: string | null,
): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    await commitImportCandidatesToGitHub(records, sha, message);
    return;
  }

  writeImportCandidatesLocal(records);
}

export function getImportCandidateIdSet(
  records: StoredImportCandidate[],
): Set<string> {
  return new Set(records.map((record) => normalizeImportContentId(record.content_id)));
}

export async function appendImportCandidates(
  newRecords: StoredImportCandidate[],
): Promise<{ addedCount: number; records: StoredImportCandidate[] }> {
  const { records, sha } = await loadImportCandidates();
  const existingIds = getImportCandidateIdSet(records);
  const toAppend: StoredImportCandidate[] = [];

  for (const record of newRecords) {
    const id = normalizeImportContentId(record.content_id);
    if (!id || existingIds.has(id)) continue;
    existingIds.add(id);
    toAppend.push(record);
  }

  if (toAppend.length === 0) {
    return { addedCount: 0, records };
  }

  const nextRecords = [...records, ...toAppend];
  await saveImportCandidates(
    nextRecords,
    `Collect ${toAppend.length} import candidates via admin`,
    sha,
  );

  return { addedCount: toAppend.length, records: nextRecords };
}

export async function updateImportCandidateStatuses(
  contentIds: string[],
  status: ImportCandidateStatus,
): Promise<void> {
  if (contentIds.length === 0) return;

  const targetIds = new Set(contentIds.map(normalizeImportContentId));
  const { records, sha } = await loadImportCandidates();

  let updated = false;
  const nextRecords = records.map((record) => {
    const id = normalizeImportContentId(record.content_id);
    if (!targetIds.has(id)) return record;

    updated = true;
    return { ...record, status };
  });

  if (!updated) return;

  const label =
    status === "added"
      ? "Mark import candidates as added"
      : status === "excluded"
        ? "Mark import candidates as excluded"
        : "Update import candidate status";

  await saveImportCandidates(nextRecords, label, sha);
}

export async function markImportCandidateAdded(contentId: string): Promise<void> {
  await updateImportCandidateStatuses([contentId], "added");
}

export async function markImportCandidatesAdded(contentIds: string[]): Promise<void> {
  await updateImportCandidateStatuses(contentIds, "added");
}

export async function markImportCandidateExcluded(
  contentId: string,
): Promise<void> {
  await updateImportCandidateStatuses([contentId], "excluded");
}

export async function resetImportCandidates(): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    const { sha } = await fetchImportCandidatesRawFromGitHub();
    await commitImportCandidatesToGitHub(
      [],
      sha,
      "Reset import-candidates.json via admin",
    );
    return;
  }

  writeImportCandidatesLocal([]);
}

export function toImportCandidatesStoreErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof GitHubImportCandidatesError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof ImportCandidatesJsonError) {
    return { message: error.message, status: error.status };
  }

  return { message: "候補データの更新に失敗しました。", status: 500 };
}
