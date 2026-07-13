import "server-only";

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { assertDoujinLocalWriteAllowed } from "@/lib/doujin/write-guard";
import { isDoujinCompactCatalogEnabled } from "@/lib/doujin/cost-flags";
import {
  DOUJIN_AUTHORS_FILE,
  DOUJIN_CIRCLES_FILE,
  DOUJIN_DATA_DIR,
  DOUJIN_FETCH_JOB_FILE,
  DOUJIN_FETCH_LOGS_FILE,
  DOUJIN_IMPORT_JOBS_FILE,
  DOUJIN_GENRES_FILE,
  DOUJIN_SERIES_FILE,
  DOUJIN_WORKS_FILE,
  DOUJIN_WORKS_RAW_DIR,
  DOUJIN_WRITE_LOCK_FILE,
  DOUJIN_WORK_AUTHORS_FILE,
  DOUJIN_WORK_CIRCLES_FILE,
  DOUJIN_WORK_GENRES_FILE,
  DOUJIN_SYNC_JOBS_FILE,
  doujinRawShardKey,
  doujinRawShardPath,
} from "@/lib/doujin/storage-paths";
import { incrPerfCounter, measureSync } from "@/lib/perf/measure";
import type {
  DoujinFetchJob,
  DoujinFetchLogEntry,
  DoujinImportJob,
  DoujinStoredAuthor,
  DoujinStoredCircle,
  DoujinStoredGenre,
  DoujinStoredSeries,
  DoujinStoredWork,
  DoujinSyncJob,
} from "@/lib/doujin/types";

function ensureDir(): void {
  mkdirSync(DOUJIN_DATA_DIR, { recursive: true });
}

function stableHash(value: unknown): string {
  return createHash("sha1")
    .update(JSON.stringify(value))
    .digest("hex");
}

function serializeJson(value: unknown, compact: boolean): string {
  return compact ? JSON.stringify(value) : `${JSON.stringify(value, null, 2)}\n`;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return measureSync(`readJson:${pathBasename(filePath)}`, () =>
      JSON.parse(readFileSync(filePath, "utf-8")),
    ) as T;
  } catch {
    return fallback;
  }
}

function pathBasename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function acquireWriteLock(timeoutMs = 15_000): () => void {
  ensureDir();
  const started = Date.now();
  while (existsSync(DOUJIN_WRITE_LOCK_FILE)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Doujin catalog write lock timeout");
    }
    const raw = readFileSync(DOUJIN_WRITE_LOCK_FILE, "utf-8");
    const age = Date.now() - Number(raw || 0);
    // 古いロックは回収（クラッシュ後）
    if (Number.isFinite(age) && age > 120_000) {
      try {
        unlinkSync(DOUJIN_WRITE_LOCK_FILE);
        break;
      } catch {
        // ignore
      }
    }
    const waitUntil = Date.now() + 50;
    while (Date.now() < waitUntil) {
      // sync lock wait
    }
  }
  writeFileSync(DOUJIN_WRITE_LOCK_FILE, String(Date.now()), "utf-8");
  return () => {
    try {
      unlinkSync(DOUJIN_WRITE_LOCK_FILE);
    } catch {
      // ignore
    }
  };
}

function writeJsonFileAtomic(
  filePath: string,
  value: unknown,
  options?: { compact?: boolean; skipIfUnchanged?: boolean },
): { wrote: boolean } {
  assertDoujinLocalWriteAllowed("doujin-catalog");
  ensureDir();
  const compact =
    options?.compact ??
    (isDoujinCompactCatalogEnabled() && filePath === DOUJIN_WORKS_FILE);
  const text = measureSync(`stringify:${pathBasename(filePath)}`, () =>
    serializeJson(value, Boolean(compact)),
  );

  if (options?.skipIfUnchanged !== false && existsSync(filePath)) {
    try {
      const prev = readFileSync(filePath, "utf-8");
      if (prev === text || prev.trimEnd() === text.trimEnd()) {
        incrPerfCounter("doujin.json.skipUnchanged");
        return { wrote: false };
      }
    } catch {
      // continue write
    }
  }

  const release = acquireWriteLock();
  try {
    const tmp = `${filePath}.tmp`;
    measureSync(`writeFile:${pathBasename(filePath)}`, () => {
      writeFileSync(tmp, text, "utf-8");
      renameSync(tmp, filePath);
    });
    incrPerfCounter("doujin.json.writes");
    return { wrote: true };
  } finally {
    release();
  }
}

export type DoujinWorkCircle = { workId: string; circleId: string };
export type DoujinWorkAuthor = { workId: string; authorId: string };
export type DoujinWorkGenre = { workId: string; genreId: string };

export type DoujinRawEntry = {
  rawApiResponse: Record<string, unknown>;
  updatedAt: string;
};

/** 公開・通常処理用。rawApiResponse は含めない想定。 */
export function stripRawFromWorks(
  works: DoujinStoredWork[],
): DoujinStoredWork[] {
  return works.map((work) => {
    if (work.rawApiResponse == null) return work;
    const rest = { ...work };
    delete rest.rawApiResponse;
    return rest;
  });
}

export function loadDoujinWorks(): DoujinStoredWork[] {
  incrPerfCounter("doujin.works.load");
  const works = readJsonFile<DoujinStoredWork[]>(DOUJIN_WORKS_FILE, []);
  return stripRawFromWorks(works);
}

export function saveDoujinWorks(works: DoujinStoredWork[]): {
  wrote: boolean;
} {
  incrPerfCounter("doujin.works.save.attempt");
  return writeJsonFileAtomic(DOUJIN_WORKS_FILE, stripRawFromWorks(works), {
    compact: isDoujinCompactCatalogEnabled(),
    skipIfUnchanged: true,
  });
}

function readRawShard(workId: string): Record<string, DoujinRawEntry> {
  const filePath = doujinRawShardPath(workId);
  return readJsonFile(filePath, {});
}

export function loadDoujinRawByWorkId(
  workId: string,
): DoujinRawEntry | null {
  const shard = readRawShard(workId);
  return shard[workId] ?? null;
}

export function saveDoujinRawEntries(
  entries: Record<string, DoujinRawEntry>,
): { wrote: boolean } {
  if (Object.keys(entries).length === 0) return { wrote: false };
  assertDoujinLocalWriteAllowed("doujin-catalog-raw");
  mkdirSync(DOUJIN_WORKS_RAW_DIR, { recursive: true });

  const byShard = new Map<string, Record<string, DoujinRawEntry>>();
  for (const [workId, entry] of Object.entries(entries)) {
    const key = doujinRawShardKey(workId);
    const current = byShard.get(key) ?? readRawShard(workId);
    current[workId] = entry;
    byShard.set(key, current);
  }

  let wroteAny = false;
  for (const [key, payload] of byShard.entries()) {
    const filePath = `${DOUJIN_WORKS_RAW_DIR}/${key}.json`;
    const result = writeJsonFileAtomic(filePath, payload, {
      compact: true,
      skipIfUnchanged: true,
    });
    wroteAny = wroteAny || result.wrote;
  }
  return { wrote: wroteAny };
}

export function loadDoujinCircles(): DoujinStoredCircle[] {
  return readJsonFile(DOUJIN_CIRCLES_FILE, []);
}

export function saveDoujinCircles(circles: DoujinStoredCircle[]): void {
  writeJsonFileAtomic(DOUJIN_CIRCLES_FILE, circles, { compact: true });
}

export function loadDoujinAuthors(): DoujinStoredAuthor[] {
  return readJsonFile(DOUJIN_AUTHORS_FILE, []);
}

export function saveDoujinAuthors(authors: DoujinStoredAuthor[]): void {
  writeJsonFileAtomic(DOUJIN_AUTHORS_FILE, authors, { compact: true });
}

export function loadDoujinSeries(): DoujinStoredSeries[] {
  return readJsonFile(DOUJIN_SERIES_FILE, []);
}

export function saveDoujinSeries(series: DoujinStoredSeries[]): void {
  writeJsonFileAtomic(DOUJIN_SERIES_FILE, series, { compact: true });
}

export function loadDoujinGenres(): DoujinStoredGenre[] {
  return readJsonFile(DOUJIN_GENRES_FILE, []);
}

export function saveDoujinGenres(genres: DoujinStoredGenre[]): void {
  writeJsonFileAtomic(DOUJIN_GENRES_FILE, genres, { compact: true });
}

export function loadDoujinWorkCircles(): DoujinWorkCircle[] {
  return readJsonFile(DOUJIN_WORK_CIRCLES_FILE, []);
}

export function saveDoujinWorkCircles(rows: DoujinWorkCircle[]): void {
  writeJsonFileAtomic(DOUJIN_WORK_CIRCLES_FILE, rows, { compact: true });
}

export function loadDoujinWorkAuthors(): DoujinWorkAuthor[] {
  return readJsonFile(DOUJIN_WORK_AUTHORS_FILE, []);
}

export function saveDoujinWorkAuthors(rows: DoujinWorkAuthor[]): void {
  writeJsonFileAtomic(DOUJIN_WORK_AUTHORS_FILE, rows, { compact: true });
}

export function loadDoujinWorkGenres(): DoujinWorkGenre[] {
  return readJsonFile(DOUJIN_WORK_GENRES_FILE, []);
}

export function saveDoujinWorkGenres(rows: DoujinWorkGenre[]): void {
  writeJsonFileAtomic(DOUJIN_WORK_GENRES_FILE, rows, { compact: true });
}

export function loadDoujinFetchJob(): DoujinFetchJob | null {
  return readJsonFile(DOUJIN_FETCH_JOB_FILE, null);
}

export function saveDoujinFetchJob(job: DoujinFetchJob): void {
  writeJsonFileAtomic(DOUJIN_FETCH_JOB_FILE, job, { compact: true });
}

export function loadDoujinFetchLogs(): DoujinFetchLogEntry[] {
  return readJsonFile(DOUJIN_FETCH_LOGS_FILE, []);
}

export function appendDoujinFetchLog(
  entry: Omit<DoujinFetchLogEntry, "id" | "at"> & { id?: string; at?: string },
): void {
  const logs = loadDoujinFetchLogs();
  const next: DoujinFetchLogEntry = {
    id:
      entry.id ??
      `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
    level: entry.level,
    message: entry.message,
    jobId: entry.jobId,
    contentId: entry.contentId,
    detail: entry.detail,
  };
  writeJsonFileAtomic(
    DOUJIN_FETCH_LOGS_FILE,
    [next, ...logs].slice(0, 500),
    { compact: true },
  );
}

export function loadDoujinImportJobs(): DoujinImportJob[] {
  return readJsonFile(DOUJIN_IMPORT_JOBS_FILE, []);
}

export function saveDoujinImportJobs(jobs: DoujinImportJob[]): void {
  writeJsonFileAtomic(DOUJIN_IMPORT_JOBS_FILE, jobs, { compact: true });
}

export function loadDoujinImportJobById(
  id: string,
): DoujinImportJob | undefined {
  return loadDoujinImportJobs().find((job) => job.id === id);
}

export function loadLatestDoujinImportJob(
  jobType?: DoujinImportJob["jobType"],
): DoujinImportJob | null {
  const jobs = loadDoujinImportJobs();
  const filtered = jobType
    ? jobs.filter((job) => job.jobType === jobType)
    : jobs;
  return filtered[0] ?? null;
}

export function upsertDoujinImportJob(job: DoujinImportJob): void {
  const jobs = loadDoujinImportJobs().filter((row) => row.id !== job.id);
  writeJsonFileAtomic(
    DOUJIN_IMPORT_JOBS_FILE,
    [job, ...jobs].slice(0, 50),
    { compact: true },
  );
}

export function loadDoujinSyncJobs(): DoujinSyncJob[] {
  return readJsonFile(DOUJIN_SYNC_JOBS_FILE, []);
}

export function loadDoujinSyncJobById(id: string): DoujinSyncJob | undefined {
  return loadDoujinSyncJobs().find((job) => job.id === id);
}

export function loadLatestDoujinSyncJob(
  mode?: DoujinSyncJob["mode"],
): DoujinSyncJob | null {
  const jobs = loadDoujinSyncJobs();
  const filtered = mode ? jobs.filter((job) => job.mode === mode) : jobs;
  return filtered[0] ?? null;
}

export function upsertDoujinSyncJob(job: DoujinSyncJob): void {
  const jobs = loadDoujinSyncJobs().filter((row) => row.id !== job.id);
  writeJsonFileAtomic(DOUJIN_SYNC_JOBS_FILE, [job, ...jobs].slice(0, 50), {
    compact: true,
  });
}

export function catalogContentFingerprint(works: DoujinStoredWork[]): string {
  return stableHash({
    count: works.length,
    head: works[0]?.updatedAt,
    tail: works[works.length - 1]?.updatedAt,
  });
}
