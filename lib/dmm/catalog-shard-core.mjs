/**
 * カタログ shard 分割の共通ロジック（Node スクリプト / TS 双方から利用）
 */

import {
  dedupeCatalogWorks,
  getWorkMatchKeys,
  hasWorkIdentity,
  normalizeWorkId,
} from "./catalog-dedupe-core.mjs";

export const CATALOG_SHARD_DIR_RELATIVE = "data/dmm/catalog";
export const CATALOG_MANIFEST_RELATIVE = "data/dmm/catalog/manifest.json";
export const CATALOG_LEGACY_SNAPSHOT_RELATIVE = "data/dmm/catalog-snapshot.json";
export const CATALOG_LEGACY_BACKUP_RELATIVE =
  "data/dmm/catalog-snapshot.legacy.json";
export const DEFAULT_SHARD_SIZE = 500;
export const CATALOG_SHARD_VERSION = 1;

const WRAPPER_ARRAY_KEYS = ["works", "items", "catalog", "data", "products"];

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function parseJsonMaybe(value) {
  let data = value;
  for (let index = 0; index < 2; index += 1) {
    if (typeof data !== "string") break;
    try {
      data = JSON.parse(data);
    } catch {
      break;
    }
  }
  return data;
}

/**
 * @param {unknown} data
 * @returns {unknown[]}
 */
export function extractRawCatalogEntries(data) {
  const parsed = parseJsonMaybe(data);
  if (parsed == null) return [];
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const key of WRAPPER_ARRAY_KEYS) {
      const value = /** @type {Record<string, unknown>} */ (parsed)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
export function normalizeCatalogWorkEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = /** @type {Record<string, unknown>} */ (value);
  const contentId =
    (typeof record.content_id === "string" && record.content_id.trim()) ||
    (typeof record.id === "string" && record.id.trim()) ||
    "";
  if (!contentId) return null;

  return {
    ...record,
    content_id: contentId,
    product_id:
      typeof record.product_id === "string" && record.product_id.trim()
        ? record.product_id.trim()
        : contentId,
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : contentId,
  };
}

/**
 * @param {unknown} input
 * @returns {Record<string, unknown>[]}
 */
export function normalizeCatalogWorks(input) {
  /** @type {Record<string, unknown>[]} */
  const normalized = [];
  for (const entry of extractRawCatalogEntries(input)) {
    const item = normalizeCatalogWorkEntry(entry);
    if (item) normalized.push(item);
  }
  return normalized;
}

/**
 * @param {number} index1Based
 * @returns {string}
 */
export function formatShardFileName(index1Based) {
  return `catalog-${String(index1Based).padStart(4, "0")}.json`;
}

/**
 * @param {string} fileName
 * @returns {number | null}
 */
export function parseShardFileIndex(fileName) {
  const match = /^catalog-(\d+)\.json$/i.exec(fileName);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * @param {unknown} data
 * @returns {string}
 */
export function serializeJsonPretty(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/**
 * @param {{
 *   works: Record<string, unknown>[];
 *   shardSize?: number;
 *   updatedAt?: string;
 * }} input
 */
export function buildCatalogShards(input) {
  const shardSize = input.shardSize ?? DEFAULT_SHARD_SIZE;
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const { items: works, stats } = dedupeCatalogWorks(input.works);

  /** @type {Array<{ file: string; count: number; works: Record<string, unknown>[] }>} */
  const shards = [];
  for (let offset = 0; offset < works.length; offset += shardSize) {
    const chunk = works.slice(offset, offset + shardSize);
    const file = formatShardFileName(shards.length + 1);
    shards.push({ file, count: chunk.length, works: chunk });
  }

  if (shards.length === 0) {
    shards.push({
      file: formatShardFileName(1),
      count: 0,
      works: [],
    });
  }

  const manifest = {
    version: CATALOG_SHARD_VERSION,
    totalCount: works.length,
    shardSize,
    updatedAt,
    shards: shards.map((shard) => ({
      file: shard.file,
      count: shard.count,
    })),
  };

  return { manifest, shards, works, stats };
}

/**
 * @param {object} manifest
 * @param {Record<string, unknown>[]} lastShardWorks
 * @param {Record<string, unknown>[]} newWorks
 * @param {number} [shardSize]
 */
export function appendWorksToLastShards(
  manifest,
  lastShardWorks,
  newWorks,
  shardSize = DEFAULT_SHARD_SIZE,
) {
  const size =
    typeof manifest.shardSize === "number" && manifest.shardSize > 0
      ? manifest.shardSize
      : shardSize;

  const existingShards = Array.isArray(manifest.shards)
    ? [...manifest.shards]
    : [];

  let lastIndex = existingShards.length;
  let currentWorks = [...lastShardWorks];
  /** @type {Array<{ file: string; works: Record<string, unknown>[]; isNew: boolean }>} */
  const changed = [];

  if (lastIndex === 0) {
    lastIndex = 1;
    currentWorks = [];
  }

  const lastFile =
    existingShards[existingShards.length - 1]?.file ??
    formatShardFileName(lastIndex);

  /** @type {Record<string, unknown>[]} */
  let pending = [...newWorks];

  const room = Math.max(0, size - currentWorks.length);
  if (room > 0 && pending.length > 0) {
    const take = pending.slice(0, room);
    pending = pending.slice(room);
    currentWorks = [...currentWorks, ...take];
  }

  changed.push({
    file: lastFile,
    works: currentWorks,
    isNew: existingShards.length === 0,
  });

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
    const take = pending.slice(0, size);
    pending = pending.slice(size);
    const file = formatShardFileName(nextIndex);
    changed.push({ file, works: take, isNew: true });
    nextShardEntries.push({ file, count: take.length });
    nextIndex += 1;
  }

  const totalCount = nextShardEntries.reduce(
    (sum, entry) => sum + (Number(entry.count) || 0),
    0,
  );

  const nextManifest = {
    version: CATALOG_SHARD_VERSION,
    totalCount,
    shardSize: size,
    updatedAt: new Date().toISOString(),
    shards: nextShardEntries,
  };

  return {
    manifest: nextManifest,
    changedShards: changed,
    updatedShardFiles: changed
      .filter((entry) => !entry.isNew)
      .map((entry) => entry.file),
    newShardFiles: changed
      .filter((entry) => entry.isNew)
      .map((entry) => entry.file),
  };
}

/**
 * @param {Record<string, unknown>[]} works
 * @returns {Set<string>}
 */
export function buildCatalogIdSetFromWorks(works) {
  const ids = new Set();
  for (const work of works) {
    for (const key of getWorkMatchKeys(work)) {
      ids.add(key);
    }
  }
  return ids;
}

/**
 * @param {Record<string, unknown>} work
 * @param {Set<string>} catalogIds
 */
export function workMatchesCatalogIds(work, catalogIds) {
  if (!hasWorkIdentity(work)) return false;
  for (const key of getWorkMatchKeys(work)) {
    if (catalogIds.has(key)) return true;
  }
  return false;
}

export {
  dedupeCatalogWorks,
  getWorkMatchKeys,
  hasWorkIdentity,
  normalizeWorkId,
};
