import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  appendImportCollectLogEntry,
  createEmptyImportCollectLog,
  type ImportCollectLogDocument,
  type ImportCollectLogEntry,
} from "@/lib/admin/import-collect-log";
import { canWriteProjectDataFiles } from "@/lib/admin/runtime-fs";

const LOG_DIR = path.join(process.cwd(), "data", "dmm");
const LOG_FILE = path.join(LOG_DIR, "import-collect-log.json");

/**
 * Debug-only collect summary. Not a source of truth for batch state.
 * Production (Vercel): console only. Local dev: optional JSON file.
 */
export function readImportCollectLogLocal(): ImportCollectLogDocument {
  if (!canWriteProjectDataFiles() || !existsSync(LOG_FILE)) {
    return createEmptyImportCollectLog();
  }

  try {
    const raw = JSON.parse(readFileSync(LOG_FILE, "utf-8")) as ImportCollectLogDocument;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.entries)) {
      return createEmptyImportCollectLog();
    }
    return raw;
  } catch {
    return createEmptyImportCollectLog();
  }
}

function writeImportCollectLogLocal(document: ImportCollectLogDocument): void {
  if (!canWriteProjectDataFiles()) {
    return;
  }

  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(LOG_FILE, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
}

export async function saveImportCollectLog(entry: ImportCollectLogEntry): Promise<void> {
  console.log("[import-collect-log]", entry);

  if (!canWriteProjectDataFiles()) {
    return;
  }

  try {
    const current = readImportCollectLogLocal();
    writeImportCollectLogLocal(appendImportCollectLogEntry(current, entry));
  } catch (error) {
    console.warn("[import-collect-log] local file write skipped", error);
  }
}

/** @deprecated Use saveImportCollectLog */
export async function appendImportCollectLog(
  entry: ImportCollectLogEntry,
): Promise<void> {
  await saveImportCollectLog(entry);
}
