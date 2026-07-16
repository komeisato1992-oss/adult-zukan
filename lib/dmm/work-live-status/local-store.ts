import "server-only";

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type {
  WorkLiveStatusRow,
  WorkLiveStatusUpsertInput,
} from "@/lib/dmm/work-live-status/types";

export const WORK_LIVE_STATUS_LOCAL_RELATIVE_PATH =
  "data/dmm/work-live-status.json";

type LocalFile = {
  version: 1;
  updatedAt: string | null;
  entries: Record<string, WorkLiveStatusRow>;
};

type MemoryStore = typeof globalThis & {
  __workLiveStatusLocal?: LocalFile | null;
  __workLiveStatusLocalMtimeMs?: number;
};

function getMemoryStore(): MemoryStore {
  return globalThis as MemoryStore;
}

function absolutePath(): string {
  return path.join(process.cwd(), WORK_LIVE_STATUS_LOCAL_RELATIVE_PATH);
}

function emptyFile(): LocalFile {
  return { version: 1, updatedAt: null, entries: {} };
}

function getFileMtimeMs(): number {
  const filePath = absolutePath();
  if (!existsSync(filePath)) return 0;
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function parseFile(raw: unknown): LocalFile {
  if (!raw || typeof raw !== "object") return emptyFile();
  const obj = raw as Partial<LocalFile>;
  const entries: Record<string, WorkLiveStatusRow> = {};
  if (obj.entries && typeof obj.entries === "object") {
    for (const [key, value] of Object.entries(obj.entries)) {
      if (!value || typeof value !== "object") continue;
      const cid = normalizeCatalogContentId(
        (value as WorkLiveStatusRow).cid || key,
      );
      if (!cid) continue;
      entries[cid] = { ...(value as WorkLiveStatusRow), cid };
    }
  }
  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : null,
    entries,
  };
}

function readFile(): LocalFile {
  const store = getMemoryStore();
  const mtimeMs = getFileMtimeMs();
  if (store.__workLiveStatusLocal && store.__workLiveStatusLocalMtimeMs === mtimeMs) {
    return store.__workLiveStatusLocal;
  }

  const filePath = absolutePath();
  if (!existsSync(filePath)) {
    const empty = emptyFile();
    store.__workLiveStatusLocal = empty;
    store.__workLiveStatusLocalMtimeMs = mtimeMs;
    return empty;
  }

  try {
    const parsed = parseFile(JSON.parse(readFileSync(filePath, "utf8")));
    store.__workLiveStatusLocal = parsed;
    store.__workLiveStatusLocalMtimeMs = mtimeMs;
    return parsed;
  } catch {
    const empty = emptyFile();
    store.__workLiveStatusLocal = empty;
    store.__workLiveStatusLocalMtimeMs = mtimeMs;
    return empty;
  }
}

function writeFile(file: LocalFile): void {
  const store = getMemoryStore();
  store.__workLiveStatusLocal = file;
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(absolutePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
    store.__workLiveStatusLocalMtimeMs = getFileMtimeMs();
  } catch {
    // read-only FS — memory cache is enough for this process
  }
}

export async function localFetchLiveStatusByCids(
  cids: string[],
): Promise<Map<string, WorkLiveStatusRow>> {
  const file = readFile();
  const map = new Map<string, WorkLiveStatusRow>();
  for (const raw of cids) {
    const cid = normalizeCatalogContentId(raw);
    if (!cid) continue;
    const row = file.entries[cid];
    if (row) map.set(cid, row);
  }
  return map;
}

export async function localUpsertLiveStatusRows(
  rows: WorkLiveStatusUpsertInput[],
): Promise<{ upserted: number }> {
  if (rows.length === 0) return { upserted: 0 };

  const file = readFile();
  const now = new Date().toISOString();
  let upserted = 0;

  for (const row of rows) {
    const cid = normalizeCatalogContentId(row.cid);
    if (!cid) continue;
    file.entries[cid] = {
      ...row,
      cid,
      updated_at: row.updated_at ?? now,
    };
    upserted += 1;
  }

  if (upserted > 0) {
    file.updatedAt = now;
    writeFile(file);
  }

  return { upserted };
}

export async function localCountLiveStatusRows(): Promise<number> {
  return Object.keys(readFile().entries).length;
}

export async function localFetchAllLiveStatusCids(): Promise<string[]> {
  return Object.keys(readFile().entries);
}

export function invalidateLocalLiveStatusCache(): void {
  const store = getMemoryStore();
  store.__workLiveStatusLocal = null;
  store.__workLiveStatusLocalMtimeMs = -1;
}

export function getLocalLiveStatusMtimeMs(): number {
  return getFileMtimeMs();
}
