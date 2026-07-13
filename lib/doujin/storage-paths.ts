import "server-only";

import path from "path";

export const DOUJIN_DATA_DIR = path.join(process.cwd(), "data", "doujin");
export const DOUJIN_WORKS_FILE = path.join(DOUJIN_DATA_DIR, "works.json");
/** rawApiResponse 専用（workId 先頭文字でシャード分割） */
export const DOUJIN_WORKS_RAW_DIR = path.join(DOUJIN_DATA_DIR, "works-raw");
export const DOUJIN_WRITE_LOCK_FILE = path.join(
  DOUJIN_DATA_DIR,
  ".works-write.lock",
);
export const DOUJIN_CIRCLES_FILE = path.join(DOUJIN_DATA_DIR, "circles.json");
export const DOUJIN_AUTHORS_FILE = path.join(DOUJIN_DATA_DIR, "authors.json");
export const DOUJIN_SERIES_FILE = path.join(DOUJIN_DATA_DIR, "series.json");
export const DOUJIN_GENRES_FILE = path.join(DOUJIN_DATA_DIR, "genres.json");
export const DOUJIN_FETCH_JOB_FILE = path.join(DOUJIN_DATA_DIR, "fetch-job.json");
export const DOUJIN_FETCH_LOGS_FILE = path.join(
  DOUJIN_DATA_DIR,
  "fetch-logs.json",
);
export const DOUJIN_IMPORT_JOBS_FILE = path.join(
  DOUJIN_DATA_DIR,
  "import-jobs.json",
);
export const DOUJIN_SYNC_JOBS_FILE = path.join(
  DOUJIN_DATA_DIR,
  "sync-jobs.json",
);

export function doujinRawShardKey(workId: string): string {
  const id = String(workId || "_");
  // work_<hash> 形式では先頭が常に w になるため、hash 先頭2文字で分割
  const hash = id.includes("_") ? id.split("_").pop() || id : id;
  const key = hash.slice(0, 2).toLowerCase();
  return /^[0-9a-z]{1,2}$/.test(key) ? key : "_";
}

export function doujinRawShardPath(workId: string): string {
  return path.join(DOUJIN_WORKS_RAW_DIR, `${doujinRawShardKey(workId)}.json`);
}

export const DOUJIN_WORK_CIRCLES_FILE = path.join(
  DOUJIN_DATA_DIR,
  "work-circles.json",
);
export const DOUJIN_WORK_AUTHORS_FILE = path.join(
  DOUJIN_DATA_DIR,
  "work-authors.json",
);
export const DOUJIN_WORK_GENRES_FILE = path.join(
  DOUJIN_DATA_DIR,
  "work-genres.json",
);
