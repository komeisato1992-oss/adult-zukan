import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  buildCatalogIdSet,
  dedupeCatalogWorks,
} from "@/lib/dmm/catalog-dedupe";
import { normalizeCatalogSnapshot } from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

export const CATALOG_SHARD_DIR_RELATIVE = "data/dmm/catalog";
export const CATALOG_MANIFEST_RELATIVE = "data/dmm/catalog/manifest.json";
export const CATALOG_LEGACY_SNAPSHOT_RELATIVE = "data/dmm/catalog-snapshot.json";
export const CATALOG_LEGACY_BACKUP_RELATIVE =
  "data/dmm/catalog-snapshot.legacy.json";
export const DEFAULT_CATALOG_SHARD_SIZE = 500;
export const CATALOG_SHARD_VERSION = 1;

export type CatalogShardMeta = {
  file: string;
  count: number;
};

export type CatalogManifest = {
  version: number;
  totalCount: number;
  shardSize: number;
  updatedAt: string;
  shards: CatalogShardMeta[];
};

export type CatalogShardWrite = {
  file: string;
  works: DmmItem[];
  isNew: boolean;
};

export type CatalogAppendResult = {
  manifest: CatalogManifest;
  changedShards: CatalogShardWrite[];
  updatedShardFiles: string[];
  newShardFiles: string[];
};

const MANIFEST_PATH = path.join(process.cwd(), CATALOG_MANIFEST_RELATIVE);
const SHARD_DIR = path.join(process.cwd(), CATALOG_SHARD_DIR_RELATIVE);
const LEGACY_PATH = path.join(process.cwd(), CATALOG_LEGACY_SNAPSHOT_RELATIVE);

let cachedManifest: CatalogManifest | null = null;
let cachedWorks: DmmItem[] | null = null;
const cachedShards = new Map<string, DmmItem[]>();

export function clearCatalogShardCache(): void {
  cachedManifest = null;
  cachedWorks = null;
  cachedShards.clear();
}

function serializeJsonPretty(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function shardRelativePath(file: string): string {
  return `${CATALOG_SHARD_DIR_RELATIVE}/${file}`;
}

export function formatShardFileName(index1Based: number): string {
  return `catalog-${String(index1Based).padStart(4, "0")}.json`;
}

export function hasCatalogShardsLocally(): boolean {
  return existsSync(MANIFEST_PATH);
}

function parseShardArray(raw: unknown): DmmItem[] {
  if (!Array.isArray(raw)) {
    throw new Error("Catalog shard must be a JSON array");
  }
  return normalizeCatalogSnapshot(raw);
}

export function getCatalogManifest(): CatalogManifest | null {
  if (cachedManifest) return cachedManifest;
  if (!existsSync(MANIFEST_PATH)) return null;

  try {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as CatalogManifest;
    cachedManifest = {
      version: Number(raw.version) || CATALOG_SHARD_VERSION,
      totalCount: Number(raw.totalCount) || 0,
      shardSize:
        Number(raw.shardSize) > 0
          ? Number(raw.shardSize)
          : DEFAULT_CATALOG_SHARD_SIZE,
      updatedAt: String(raw.updatedAt ?? ""),
      shards: Array.isArray(raw.shards)
        ? raw.shards.map((entry) => ({
            file: String(entry.file),
            count: Number(entry.count) || 0,
          }))
        : [],
    };
    return cachedManifest;
  } catch {
    return null;
  }
}

export function getCatalogShard(file: string): DmmItem[] {
  const cached = cachedShards.get(file);
  if (cached) return cached;

  const filePath = path.join(SHARD_DIR, file);
  if (!existsSync(filePath)) {
    throw new Error(`Catalog shard missing: ${file}`);
  }

  const works = parseShardArray(JSON.parse(readFileSync(filePath, "utf-8")));
  cachedShards.set(file, works);
  return works;
}

function readLegacyCatalogWorks(): DmmItem[] {
  if (!existsSync(LEGACY_PATH)) return [];
  try {
    return normalizeCatalogSnapshot(
      JSON.parse(readFileSync(LEGACY_PATH, "utf-8")),
    );
  } catch {
    return [];
  }
}

/**
 * 全 shard を結合して返す。
 * shard が無い場合のみ legacy snapshot を読む（二重読み込みはしない）。
 */
export function getAllCatalogWorks(): DmmItem[] {
  if (cachedWorks) return cachedWorks;

  const manifest = getCatalogManifest();
  if (manifest) {
    const combined: DmmItem[] = [];
    for (const entry of manifest.shards) {
      combined.push(...getCatalogShard(entry.file));
    }
    cachedWorks = dedupeCatalogWorks(combined).items;
    return cachedWorks;
  }

  // 移行前フォールバック（移行後は manifest があるため到達しない）
  cachedWorks = dedupeCatalogWorks(readLegacyCatalogWorks()).items;
  return cachedWorks;
}

export function getCatalogWorkById(id: string): DmmItem | null {
  const normalized = id.trim().toLowerCase();
  if (!normalized) return null;
  return (
    getAllCatalogWorks().find(
      (work) =>
        work.content_id.trim().toLowerCase() === normalized ||
        work.product_id.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export function getCatalogFingerprint(): string {
  const manifest = getCatalogManifest();
  if (manifest) {
    const first = manifest.shards[0]?.file ?? "";
    const last = manifest.shards[manifest.shards.length - 1]?.file ?? "";
    return `${manifest.totalCount}:${manifest.updatedAt}:${first}:${last}`;
  }

  const works = getAllCatalogWorks();
  const first = works[0]?.content_id ?? "";
  const last = works[works.length - 1]?.content_id ?? "";
  return `${works.length}:${first}:${last}`;
}

export function appendWorksToCatalogShards(
  manifest: CatalogManifest,
  lastShardWorks: DmmItem[],
  newWorks: DmmItem[],
): CatalogAppendResult {
  const shardSize =
    manifest.shardSize > 0 ? manifest.shardSize : DEFAULT_CATALOG_SHARD_SIZE;
  const existingShards = [...manifest.shards];
  let currentWorks = [...lastShardWorks];
  const changed: CatalogShardWrite[] = [];

  const lastFile =
    existingShards[existingShards.length - 1]?.file ?? formatShardFileName(1);
  const isBrandNew = existingShards.length === 0;

  let pending = [...newWorks];
  const room = Math.max(0, shardSize - currentWorks.length);
  if (room > 0 && pending.length > 0) {
    currentWorks = [...currentWorks, ...pending.slice(0, room)];
    pending = pending.slice(room);
  }

  changed.push({ file: lastFile, works: currentWorks, isNew: isBrandNew });

  const nextShardEntries = existingShards.map((entry) => ({ ...entry }));
  if (nextShardEntries.length === 0) {
    nextShardEntries.push({ file: lastFile, count: currentWorks.length });
  } else {
    nextShardEntries[nextShardEntries.length - 1] = {
      file: lastFile,
      count: currentWorks.length,
    };
  }

  let nextIndex = nextShardEntries.length + 1;
  while (pending.length > 0) {
    const take = pending.slice(0, shardSize);
    pending = pending.slice(shardSize);
    const file = formatShardFileName(nextIndex);
    changed.push({ file, works: take, isNew: true });
    nextShardEntries.push({ file, count: take.length });
    nextIndex += 1;
  }

  const totalCount = nextShardEntries.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  const nextManifest: CatalogManifest = {
    version: CATALOG_SHARD_VERSION,
    totalCount,
    shardSize,
    updatedAt: new Date().toISOString(),
    shards: nextShardEntries,
  };

  return {
    manifest: nextManifest,
    changedShards: changed,
    updatedShardFiles: changed.filter((e) => !e.isNew).map((e) => e.file),
    newShardFiles: changed.filter((e) => e.isNew).map((e) => e.file),
  };
}

export function writeCatalogShardsLocally(
  manifest: CatalogManifest,
  shards: Array<{ file: string; works: DmmItem[] }>,
): void {
  mkdirSync(SHARD_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, serializeJsonPretty(manifest), "utf-8");
  for (const shard of shards) {
    writeFileSync(
      path.join(SHARD_DIR, shard.file),
      serializeJsonPretty(shard.works),
      "utf-8",
    );
  }
  clearCatalogShardCache();
}

/** 全作品を shard へ書き直す（フル再構築が必要な管理処理用） */
export function rewriteAllCatalogShardsLocally(
  works: DmmItem[],
  shardSize = DEFAULT_CATALOG_SHARD_SIZE,
): CatalogManifest {
  const deduped = dedupeCatalogWorks(works).items;
  const shards: Array<{ file: string; works: DmmItem[]; count: number }> = [];

  for (let offset = 0; offset < deduped.length; offset += shardSize) {
    const chunk = deduped.slice(offset, offset + shardSize);
    shards.push({
      file: formatShardFileName(shards.length + 1),
      works: chunk,
      count: chunk.length,
    });
  }

  if (shards.length === 0) {
    shards.push({
      file: formatShardFileName(1),
      works: [],
      count: 0,
    });
  }

  const manifest: CatalogManifest = {
    version: CATALOG_SHARD_VERSION,
    totalCount: deduped.length,
    shardSize,
    updatedAt: new Date().toISOString(),
    shards: shards.map((shard) => ({ file: shard.file, count: shard.count })),
  };

  writeCatalogShardsLocally(
    manifest,
    shards.map((shard) => ({ file: shard.file, works: shard.works })),
  );

  return manifest;
}

export function buildCatalogIdSetFromLocalShards(): Set<string> {
  return buildCatalogIdSet(getAllCatalogWorks());
}

export { serializeJsonPretty as serializeCatalogShardJson };
