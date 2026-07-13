import "server-only";

import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { isAdultMediaShardEnabled } from "@/lib/dmm/cost-flags";
import { assertAdultLocalWriteAllowed } from "@/lib/dmm/write-guard";
import type { DmmItem, DmmSampleImageUrl, DmmSampleMovieUrl } from "@/lib/dmm/types";
import { incrPerfCounter, measureSync } from "@/lib/perf/measure";

export const CATALOG_MEDIA_DIR_RELATIVE = "data/dmm/catalog-media";
const MEDIA_DIR = path.join(process.cwd(), CATALOG_MEDIA_DIR_RELATIVE);

export type AdultCatalogMediaEntry = {
  content_id: string;
  sampleImageURL?: DmmSampleImageUrl;
  sampleMovieURL?: DmmSampleMovieUrl;
  updatedAt?: string;
};

type MediaShardFile = {
  version: 1;
  updatedAt: string;
  entries: Record<string, AdultCatalogMediaEntry>;
};

const shardCache = new Map<string, MediaShardFile>();

export function clearAdultCatalogMediaCache(): void {
  shardCache.clear();
}

export function adultMediaShardKey(contentId: string): string {
  const id = String(contentId || "").trim().toLowerCase();
  if (!id) return "_";
  const hash = createHash("sha1").update(id).digest("hex");
  return hash.slice(0, 2);
}

export function adultMediaShardRelativePath(contentId: string): string {
  return `${CATALOG_MEDIA_DIR_RELATIVE}/${adultMediaShardKey(contentId)}.json`;
}

export function hasAdultCatalogMediaDir(): boolean {
  return existsSync(MEDIA_DIR);
}

function emptyShard(): MediaShardFile {
  return { version: 1, updatedAt: new Date().toISOString(), entries: {} };
}

function readMediaShard(key: string): MediaShardFile {
  const cached = shardCache.get(key);
  if (cached) return cached;
  const filePath = path.join(MEDIA_DIR, `${key}.json`);
  if (!existsSync(filePath)) {
    const empty = emptyShard();
    shardCache.set(key, empty);
    return empty;
  }
  const parsed = measureSync(`adult.media.read:${key}`, () =>
    JSON.parse(readFileSync(filePath, "utf-8")),
  ) as MediaShardFile;
  const shard: MediaShardFile = {
    version: 1,
    updatedAt: String(parsed.updatedAt ?? ""),
    entries:
      parsed.entries && typeof parsed.entries === "object"
        ? parsed.entries
        : {},
  };
  shardCache.set(key, shard);
  incrPerfCounter("adult.media.shard.load");
  return shard;
}

function writeMediaShardAtomic(key: string, shard: MediaShardFile): void {
  mkdirSync(MEDIA_DIR, { recursive: true });
  const filePath = path.join(MEDIA_DIR, `${key}.json`);
  const tmp = `${filePath}.${process.pid}.tmp`;
  const text = `${JSON.stringify(shard)}\n`;
  writeFileSync(tmp, text, "utf-8");
  try {
    renameSync(tmp, filePath);
  } catch {
    writeFileSync(filePath, text, "utf-8");
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

export function extractAdultMediaFields(
  work: DmmItem,
): AdultCatalogMediaEntry | null {
  if (!work.sampleImageURL && !work.sampleMovieURL) return null;
  return {
    content_id: work.content_id,
    sampleImageURL: work.sampleImageURL,
    sampleMovieURL: work.sampleMovieURL,
    updatedAt: work.updatedAt ?? work.lastRefreshedAt,
  };
}

export function stripAdultMediaFields(work: DmmItem): DmmItem {
  if (!work.sampleImageURL && !work.sampleMovieURL) return work;
  const next = { ...work };
  delete next.sampleImageURL;
  delete next.sampleMovieURL;
  return next;
}

export function loadAdultMediaForContentId(
  contentId: string,
): AdultCatalogMediaEntry | null {
  if (!isAdultMediaShardEnabled() || !hasAdultCatalogMediaDir()) return null;
  const key = adultMediaShardKey(contentId);
  const shard = readMediaShard(key);
  return shard.entries[contentId] ?? null;
}

export function hydrateAdultWorkMedia(work: DmmItem): DmmItem {
  if (work.sampleImageURL || work.sampleMovieURL) return work;
  const media = loadAdultMediaForContentId(work.content_id);
  if (!media) return work;
  return {
    ...work,
    sampleImageURL: media.sampleImageURL ?? work.sampleImageURL,
    sampleMovieURL: media.sampleMovieURL ?? work.sampleMovieURL,
  };
}

export function saveAdultMediaEntries(
  entries: AdultCatalogMediaEntry[],
  options?: { dryRun?: boolean },
): { shardCount: number; entryCount: number; wrote: boolean } {
  if (entries.length === 0) {
    return { shardCount: 0, entryCount: 0, wrote: false };
  }
  if (!options?.dryRun) {
    assertAdultLocalWriteAllowed("adult-catalog-media");
  }

  const byShard = new Map<string, AdultCatalogMediaEntry[]>();
  for (const entry of entries) {
    const key = adultMediaShardKey(entry.content_id);
    const list = byShard.get(key) ?? [];
    list.push(entry);
    byShard.set(key, list);
  }

  if (options?.dryRun) {
    return {
      shardCount: byShard.size,
      entryCount: entries.length,
      wrote: false,
    };
  }

  const now = new Date().toISOString();
  for (const [key, list] of byShard) {
    const prev = readMediaShard(key);
    const shard: MediaShardFile = {
      version: 1,
      updatedAt: now,
      entries: { ...prev.entries },
    };
    for (const entry of list) {
      shard.entries[entry.content_id] = entry;
    }
    writeMediaShardAtomic(key, shard);
    shardCache.set(key, shard);
    incrPerfCounter("adult.media.shard.write");
  }

  return {
    shardCount: byShard.size,
    entryCount: entries.length,
    wrote: true,
  };
}
