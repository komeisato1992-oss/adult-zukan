import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  createEmptyFetchedHistory,
  parseFetchedHistory,
  serializeFetchedHistory,
  type ImportFetchedHistory,
} from "@/lib/admin/import-fetched-history";
import { IMPORT_FETCHED_HISTORY_RELATIVE_PATH } from "@/lib/admin/import-fetched-history-path";

const HISTORY_FILE = path.join(
  process.cwd(),
  IMPORT_FETCHED_HISTORY_RELATIVE_PATH,
);

function readLocal(): ImportFetchedHistory {
  if (!existsSync(HISTORY_FILE)) {
    return createEmptyFetchedHistory();
  }

  try {
    return parseFetchedHistory(JSON.parse(readFileSync(HISTORY_FILE, "utf-8")));
  } catch {
    return createEmptyFetchedHistory();
  }
}

function writeLocal(history: ImportFetchedHistory): void {
  mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  writeFileSync(HISTORY_FILE, serializeFetchedHistory(history), "utf-8");
}

async function fetchFromGitHub(): Promise<{
  history: ImportFetchedHistory;
  sha: string | null;
}> {
  const { fetchFetchedHistoryFromGitHub } = await import(
    "@/lib/admin/github-import-fetched-history"
  );
  return fetchFetchedHistoryFromGitHub();
}

async function saveToGitHub(
  history: ImportFetchedHistory,
  sha: string | null,
  message: string,
): Promise<void> {
  const { commitFetchedHistoryToGitHub } = await import(
    "@/lib/admin/github-import-fetched-history"
  );
  await commitFetchedHistoryToGitHub(history, sha, message);
}

export async function loadImportFetchedHistory(): Promise<{
  history: ImportFetchedHistory;
  sha: string | null;
}> {
  if (isGitHubCatalogConfigured()) {
    return fetchFromGitHub();
  }

  return { history: readLocal(), sha: null };
}

export async function saveImportFetchedHistory(
  history: ImportFetchedHistory,
  sha: string | null,
  message: string,
): Promise<void> {
  if (isGitHubCatalogConfigured()) {
    await saveToGitHub(history, sha, message);
    return;
  }

  writeLocal(history);
}
