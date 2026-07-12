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
  mergeEntityStats,
  parseDmmReportsCsv,
  parseDmmReportsDocument,
  parseDmmReportsJson,
  serializeDmmReportsDocument,
  upsertDmmReportRows,
} from "@/lib/admin/dmm-report-parse";
import type {
  DmmImportResult,
  DmmReportsDocument,
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
  if (memory.__dmmReportsDocument) {
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
      if (error instanceof GitHubDmmReportsError && error.status === 404) {
        const empty = createEmptyDmmReportsDocument();
        memory.__dmmReportsDocument = empty;
        memory.__dmmReportsSha = null;
        return { document: empty, sha: null };
      }
      // GitHub失敗時はローカルへフォールバック
    }
  }

  const local = readDmmReportsLocal();
  memory.__dmmReportsDocument = local;
  memory.__dmmReportsSha = null;
  return { document: local, sha: null };
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
      // Vercel 等の読み取り専用FSでは無視（メモリ/GitHubが正）
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

export async function importDmmReportsText(input: {
  text: string;
  format: "json" | "csv";
  fileName?: string | null;
  source?: DmmReportsDocument["source"];
}): Promise<DmmImportResult> {
  const parsed =
    input.format === "csv"
      ? parseDmmReportsCsv(input.text)
      : parseDmmReportsJson(input.text);

  const { document, sha } = await loadDmmReportsDocument();
  const upserted = upsertDmmReportRows(document.rows, parsed.rows);
  const now = new Date().toISOString();

  const next: DmmReportsDocument = {
    version: 1,
    updatedAt: now,
    importedAt: now,
    source: input.source ?? input.format,
    fileName: input.fileName ?? document.fileName,
    rows: upserted.rows,
    entities: mergeEntityStats(document.entities, parsed.entities),
  };

  await saveDmmReportsDocument(
    next,
    `Update DMM affiliate reports (${upserted.inserted} inserted, ${upserted.updated} updated)`,
    sha,
  );

  const dates = next.rows.map((row) => row.date).sort();
  return {
    success: true,
    inserted: upserted.inserted,
    updated: upserted.updated,
    total: next.rows.length,
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
    updatedAt: now,
  };
}

export function invalidateDmmReportsMemoryCache(): void {
  const memory = getMemoryStore();
  memory.__dmmReportsDocument = null;
  memory.__dmmReportsSha = null;
}
