import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  appendImportCollectLogEntry,
  createEmptyImportCollectLog,
  type ImportCollectLogDocument,
  type ImportCollectLogEntry,
} from "@/lib/admin/import-collect-log";

const LOG_DIR = path.join(process.cwd(), "data", "dmm");
const LOG_FILE = path.join(LOG_DIR, "import-collect-log.json");

export function readImportCollectLogLocal(): ImportCollectLogDocument {
  if (!existsSync(LOG_FILE)) {
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

export function writeImportCollectLogLocal(
  document: ImportCollectLogDocument,
): void {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(LOG_FILE, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
}

export async function appendImportCollectLog(entry: ImportCollectLogEntry): Promise<void> {
  const current = readImportCollectLogLocal();
  writeImportCollectLogLocal(appendImportCollectLogEntry(current, entry));
}
