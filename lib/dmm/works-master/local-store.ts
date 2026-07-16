import "server-only";

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type {
  WorkMasterRow,
  WorkMasterUpsertInput,
} from "@/lib/dmm/works-master/types";

export const WORKS_MASTER_LOCAL_RELATIVE_PATH = "data/dmm/works-master.json";

type LocalFile = {
  version: 1;
  updatedAt: string | null;
  entries: Record<string, WorkMasterRow>;
};

type MemoryStore = typeof globalThis & {
  __worksMasterLocal?: LocalFile | null;
  __worksMasterLocalMtimeMs?: number;
};

function getMemoryStore(): MemoryStore {
  return globalThis as MemoryStore;
}

function absolutePath(): string {
  return path.join(process.cwd(), WORKS_MASTER_LOCAL_RELATIVE_PATH);
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

function asNamedList(raw: unknown): WorkMasterRow["actresses"] {
  if (!Array.isArray(raw)) return [];
  const result: WorkMasterRow["actresses"] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as { id?: number; name?: string; ruby?: string };
    const name = obj.name?.trim();
    if (!name) continue;
    result.push({
      id: typeof obj.id === "number" ? obj.id : undefined,
      name,
      ruby: obj.ruby?.trim() || undefined,
    });
  }
  return result;
}

function normalizeRow(raw: Partial<WorkMasterRow> & { cid?: string }): WorkMasterRow | null {
  const cid = normalizeCatalogContentId(raw.cid ?? "");
  if (!cid) return null;
  const now = new Date().toISOString();
  return {
    cid,
    slug: (raw.slug?.trim() || cid),
    title: (raw.title?.trim() || cid),
    description: raw.description?.trim() || null,
    package_image: raw.package_image?.trim() || null,
    sample_images: Array.isArray(raw.sample_images)
      ? raw.sample_images.filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
      : [],
    actresses: asNamedList(raw.actresses),
    maker: raw.maker?.trim() || null,
    label: raw.label?.trim() || null,
    series: raw.series?.trim() || null,
    genres: asNamedList(raw.genres),
    release_date: raw.release_date?.trim() || null,
    duration: raw.duration?.trim() || null,
    product_code: raw.product_code?.trim() || null,
    affiliate_url: raw.affiliate_url?.trim() || null,
    published: raw.published !== false,
    manual_hidden: raw.manual_hidden === true,
    manual_hidden_reason: raw.manual_hidden_reason?.trim() || null,
    deleted_at: raw.deleted_at || null,
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
  };
}

function parseFile(raw: unknown): LocalFile {
  if (!raw || typeof raw !== "object") return emptyFile();
  const obj = raw as Partial<LocalFile>;
  const entries: Record<string, WorkMasterRow> = {};
  if (obj.entries && typeof obj.entries === "object") {
    for (const [key, value] of Object.entries(obj.entries)) {
      if (!value || typeof value !== "object") continue;
      const row = normalizeRow({ ...(value as WorkMasterRow), cid: (value as WorkMasterRow).cid || key });
      if (row) entries[row.cid] = row;
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
  if (store.__worksMasterLocal && store.__worksMasterLocalMtimeMs === mtimeMs) {
    return store.__worksMasterLocal;
  }

  const filePath = absolutePath();
  if (!existsSync(filePath)) {
    const empty = emptyFile();
    store.__worksMasterLocal = empty;
    store.__worksMasterLocalMtimeMs = mtimeMs;
    return empty;
  }

  try {
    const parsed = parseFile(JSON.parse(readFileSync(filePath, "utf8")));
    store.__worksMasterLocal = parsed;
    store.__worksMasterLocalMtimeMs = mtimeMs;
    return parsed;
  } catch {
    const empty = emptyFile();
    store.__worksMasterLocal = empty;
    store.__worksMasterLocalMtimeMs = mtimeMs;
    return empty;
  }
}

function writeFile(file: LocalFile): void {
  const store = getMemoryStore();
  store.__worksMasterLocal = file;
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(absolutePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
    store.__worksMasterLocalMtimeMs = getFileMtimeMs();
  } catch {
    // read-only FS — memory is enough for this process
  }
}

export async function localFetchWorkMasterByCids(
  cids: string[],
): Promise<Map<string, WorkMasterRow>> {
  const file = readFile();
  const map = new Map<string, WorkMasterRow>();
  for (const raw of cids) {
    const cid = normalizeCatalogContentId(raw);
    if (!cid) continue;
    const row = file.entries[cid];
    if (row) map.set(cid, row);
  }
  return map;
}

export async function localFetchAllPublishedWorkMasters(): Promise<WorkMasterRow[]> {
  return Object.values(readFile().entries).filter((row) => row.published);
}

export async function localFetchAllWorkMasterCids(): Promise<string[]> {
  return Object.keys(readFile().entries);
}

export async function localUpsertWorkMasterRows(
  rows: WorkMasterUpsertInput[],
): Promise<{ upserted: number }> {
  if (rows.length === 0) return { upserted: 0 };

  const file = readFile();
  const now = new Date().toISOString();
  let upserted = 0;

  for (const row of rows) {
    const cid = normalizeCatalogContentId(row.cid);
    if (!cid) continue;
    const existing = file.entries[cid];
    file.entries[cid] = {
      ...row,
      cid,
      slug: row.slug?.trim() || cid,
      title: row.title?.trim() || cid,
      created_at: existing?.created_at ?? row.created_at ?? now,
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

export async function localCountWorkMasterRows(): Promise<number> {
  return Object.keys(readFile().entries).length;
}

export function invalidateLocalWorksMasterCache(): void {
  const store = getMemoryStore();
  store.__worksMasterLocal = null;
  store.__worksMasterLocalMtimeMs = -1;
}

export function getLocalWorksMasterMtimeMs(): number {
  return getFileMtimeMs();
}
