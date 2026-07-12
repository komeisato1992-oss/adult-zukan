import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  commitDmmReportsToGitHub,
  fetchDmmReportsFromGitHub,
  GitHubDmmReportsError,
} from "@/lib/admin/github-dmm-reports";
import {
  createEmptyDmmReportsDocument,
  decodeDmmCsvBuffer,
  parseDmmReportsDocument,
  parseDmmRewardCsv,
  resolveDmmRewardType,
  serializeDmmReportsDocument,
  upsertDmmRewardRows,
} from "@/lib/admin/dmm-report-parse";
import type {
  DmmImportResult,
  DmmReportsDocument,
  DmmRewardType,
} from "@/lib/admin/dmm-report-types";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
const DMM_REPORTS_FILE = path.join(ADMIN_DATA_DIR, "dmm-reports.json");

type MemoryStore = typeof globalThis & {
  __dmmReportsDocument?: DmmReportsDocument | null;
  __dmmReportsSha?: string | null;
};

function getMemoryStore(): MemoryStore {
  return globalThis as MemoryStore;
}

export function readDmmReportsLocal(): DmmReportsDocument {
  if (!existsSync(DMM_REPORTS_FILE)) {
    return createEmptyDmmReportsDocument();
  }
  try {
    return parseDmmReportsDocument(readFileSync(DMM_REPORTS_FILE, "utf-8"));
  } catch {
    return createEmptyDmmReportsDocument();
  }
}

export function writeDmmReportsLocal(document: DmmReportsDocument): void {
  mkdirSync(ADMIN_DATA_DIR, { recursive: true });
  writeFileSync(
    DMM_REPORTS_FILE,
    serializeDmmReportsDocument(document),
    "utf-8",
  );
}

export async function loadDmmReportsDocument(): Promise<{
  document: DmmReportsDocument;
  sha: string | null;
}> {
  const memory = getMemoryStore();
  const hasRows =
    Boolean(memory.__dmmReportsDocument?.updatedAt) ||
    (memory.__dmmReportsDocument?.rows.length ?? 0) > 0;
  if (memory.__dmmReportsDocument && hasRows) {
    return {
      document: memory.__dmmReportsDocument,
      sha: memory.__dmmReportsSha ?? null,
    };
  }

  if (isGitHubCatalogConfigured()) {
    try {
      const loaded = await fetchDmmReportsFromGitHub();
      memory.__dmmReportsDocument = loaded.document;
      memory.__dmmReportsSha = loaded.sha;
      return loaded;
    } catch (error) {
      if (!(error instanceof GitHubDmmReportsError && error.status === 404)) {
        // fall through
      }
    }
  }

  const local = readDmmReportsLocal();
  if (local.updatedAt || local.rows.length > 0) {
    memory.__dmmReportsDocument = local;
    memory.__dmmReportsSha = null;
    return { document: local, sha: null };
  }

  const empty = createEmptyDmmReportsDocument();
  memory.__dmmReportsDocument = empty;
  memory.__dmmReportsSha = null;
  return { document: empty, sha: null };
}

export async function saveDmmReportsDocument(
  document: DmmReportsDocument,
  message: string,
  sha: string | null,
): Promise<void> {
  const memory = getMemoryStore();

  const writeLocalSafe = () => {
    try {
      writeDmmReportsLocal(document);
    } catch {
      // Vercel read-only FS
    }
  };

  if (isGitHubCatalogConfigured()) {
    try {
      await commitDmmReportsToGitHub(document, sha, message);
      memory.__dmmReportsDocument = document;
      memory.__dmmReportsSha = null;
      writeLocalSafe();
      return;
    } catch (error) {
      memory.__dmmReportsDocument = document;
      writeLocalSafe();
      throw error;
    }
  }

  writeLocalSafe();
  memory.__dmmReportsDocument = document;
  memory.__dmmReportsSha = null;
}

export async function importDmmRewardCsv(input: {
  text?: string;
  buffer?: ArrayBuffer;
  type?: string | null;
  fileName?: string | null;
}): Promise<DmmImportResult> {
  const text =
    input.text ??
    (input.buffer ? decodeDmmCsvBuffer(input.buffer) : null);
  if (!text) {
    throw new Error("CSV本文が空です。");
  }

  const type: DmmRewardType = resolveDmmRewardType({
    type: input.type,
    fileName: input.fileName,
  });
  const incoming = parseDmmRewardCsv(text, type);
  const { document, sha } = await loadDmmReportsDocument();
  const upserted = upsertDmmRewardRows(document.rows, incoming);
  const now = new Date().toISOString();

  const next: DmmReportsDocument = {
    version: 2,
    updatedAt: now,
    importedAt: now,
    source: "csv",
    fileName: input.fileName ?? document.fileName,
    rows: upserted.rows,
  };

  await saveDmmReportsDocument(
    next,
    `Update DMM ${type} rewards (${upserted.inserted} inserted, ${upserted.updated} updated)`,
    sha,
  );

  const dates = next.rows.map((row) => row.date).sort();
  return {
    success: true,
    inserted: upserted.inserted,
    updated: upserted.updated,
    total: next.rows.length,
    type,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
    updatedAt: now,
  };
}

/** @deprecated use importDmmRewardCsv */
export async function importDmmReportsText(input: {
  text: string;
  format: "json" | "csv";
  fileName?: string | null;
  source?: DmmReportsDocument["source"];
  type?: string | null;
}): Promise<DmmImportResult> {
  if (input.format !== "csv") {
    throw new Error("DMM取込はカテゴリ/ダイレクトCSVのみ対応しています。");
  }
  return importDmmRewardCsv({
    text: input.text,
    fileName: input.fileName,
    type: input.type,
  });
}

export function invalidateDmmReportsMemoryCache(): void {
  const memory = getMemoryStore();
  memory.__dmmReportsDocument = null;
  memory.__dmmReportsSha = null;
}

export { decodeDmmCsvBuffer, resolveDmmRewardType };
