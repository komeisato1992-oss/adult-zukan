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
  const memoryDoc = memory.__dmmReportsDocument ?? null;

  let remoteDoc: DmmReportsDocument | null = null;
  let remoteSha: string | null = null;
  if (isGitHubCatalogConfigured()) {
    try {
      const loaded = await fetchDmmReportsFromGitHub();
      remoteDoc = loaded.document;
      remoteSha = loaded.sha;
    } catch (error) {
      if (!(error instanceof GitHubDmmReportsError && error.status === 404)) {
        // fall through
      }
    }
  }

  const localDoc = readDmmReportsLocal();
  const candidates: Array<{
    document: DmmReportsDocument;
    sha: string | null;
  }> = [];
  if (memoryDoc) {
    candidates.push({
      document: memoryDoc,
      sha: memory.__dmmReportsSha ?? null,
    });
  }
  if (remoteDoc) {
    candidates.push({ document: remoteDoc, sha: remoteSha });
  }
  if (localDoc.updatedAt || localDoc.rows.length > 0) {
    candidates.push({ document: localDoc, sha: null });
  }

  let best = candidates[0] ?? null;
  for (const candidate of candidates) {
    const bestTs = Date.parse(best?.document.updatedAt ?? "") || 0;
    const nextTs = Date.parse(candidate.document.updatedAt ?? "") || 0;
    if (nextTs > bestTs) best = candidate;
  }

  if (best) {
    memory.__dmmReportsDocument = best.document;
    memory.__dmmReportsSha = best.sha;
    return best;
  }

  const empty = createEmptyDmmReportsDocument();
  memory.__dmmReportsDocument = empty;
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
