import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  commitImportDataBundleToGitHub,
  fetchImportCollectionStateFromGitHub,
} from "@/lib/admin/github-import-candidates";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { IMPORT_COLLECT_PAGE_SIZE } from "@/lib/admin/import-constants";
import { IMPORT_COLLECTION_STATE_RELATIVE_PATH } from "@/lib/admin/import-collection-state-path";
import {
  createDefaultImportCollectionState,
  parseImportCollectionState,
  serializeImportCollectionState,
  type ImportCollectionState,
} from "@/lib/admin/import-collection-state";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import { assertLocalProjectDataWriteAllowed } from "@/lib/admin/runtime-fs";

const STATE_FILE = path.join(
  process.cwd(),
  IMPORT_COLLECTION_STATE_RELATIVE_PATH,
);

export function readImportCollectionStateLocal(): ImportCollectionState {
  if (!existsSync(STATE_FILE)) {
    return createDefaultImportCollectionState(IMPORT_COLLECT_PAGE_SIZE);
  }

  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as unknown;
    return parseImportCollectionState(raw, IMPORT_COLLECT_PAGE_SIZE);
  } catch {
    return createDefaultImportCollectionState(IMPORT_COLLECT_PAGE_SIZE);
  }
}

export function writeImportCollectionStateLocal(
  state: ImportCollectionState,
): void {
  assertLocalProjectDataWriteAllowed("import-collection-state");
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, serializeImportCollectionState(state), "utf-8");
}

export async function loadImportCollectionState(): Promise<{
  state: ImportCollectionState;
  sha: string | null;
}> {
  if (isGitHubCatalogConfigured()) {
    return fetchImportCollectionStateFromGitHub();
  }

  return {
    state: readImportCollectionStateLocal(),
    sha: null,
  };
}

export async function saveImportCandidatesAndCollectionState(
  records: StoredImportCandidate[],
  state: ImportCollectionState,
  candidatesSha: string | null,
  stateSha: string | null,
  message: string,
): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    await commitImportDataBundleToGitHub(
      records,
      candidatesSha,
      state,
      stateSha,
      message,
    );
    return;
  }

  const { writeImportCandidatesLocal } = await import(
    "@/lib/admin/import-candidates-store"
  );
  writeImportCandidatesLocal(records);
  writeImportCollectionStateLocal(state);
}
