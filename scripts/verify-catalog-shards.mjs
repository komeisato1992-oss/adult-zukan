#!/usr/bin/env node
/**
 * data/dmm/catalog/ shard 群の整合性を検証する。
 *
 * 用法:
 *   node scripts/verify-catalog-shards.mjs
 *
 * 不一致時は exit 1（build 失敗用）
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATALOG_MANIFEST_RELATIVE,
  CATALOG_SHARD_DIR_RELATIVE,
  DEFAULT_SHARD_SIZE,
  normalizeCatalogWorks,
  normalizeWorkId,
  parseShardFileIndex,
} from "../lib/dmm/catalog-shard-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function fail(message) {
  console.error(`Catalog verification failed: ${message}`);
  process.exit(1);
}

function hasImage(item) {
  const imageURL = item.imageURL;
  if (!imageURL || typeof imageURL !== "object") return false;
  return Boolean(
    imageURL.large?.trim() || imageURL.list?.trim() || imageURL.small?.trim(),
  );
}

function main() {
  const manifestPath = path.join(ROOT, CATALOG_MANIFEST_RELATIVE);
  const shardDir = path.join(ROOT, CATALOG_SHARD_DIR_RELATIVE);

  if (!existsSync(manifestPath)) {
    fail(`manifest missing: ${CATALOG_MANIFEST_RELATIVE}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`invalid manifest JSON: ${error instanceof Error ? error.message : error}`);
  }

  const shardSize =
    typeof manifest.shardSize === "number" && manifest.shardSize > 0
      ? manifest.shardSize
      : DEFAULT_SHARD_SIZE;
  const declaredShards = Array.isArray(manifest.shards) ? manifest.shards : [];
  const declaredFiles = new Set(declaredShards.map((entry) => entry.file));

  const onDiskFiles = existsSync(shardDir)
    ? readdirSync(shardDir).filter((name) => /^catalog-\d+\.json$/i.test(name))
    : [];

  const missingFiles = [];
  const invalidFiles = [];
  const emptyShards = [];
  const oversizeShards = [];
  /** @type {Record<string, unknown>[]} */
  const allWorks = [];

  for (const entry of declaredShards) {
    const filePath = path.join(shardDir, entry.file);
    if (!existsSync(filePath)) {
      missingFiles.push(entry.file);
      continue;
    }

    let raw;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      invalidFiles.push(entry.file);
      console.error(`  invalid JSON ${entry.file}: ${error}`);
      continue;
    }

    if (!Array.isArray(raw)) {
      invalidFiles.push(entry.file);
      console.error(`  shard must be array: ${entry.file}`);
      continue;
    }

    const works = normalizeCatalogWorks(raw);
    if (works.length === 0) emptyShards.push(entry.file);
    if (works.length > shardSize) oversizeShards.push(entry.file);
    if (works.length !== entry.count) {
      console.error(
        `  count mismatch ${entry.file}: manifest=${entry.count} actual=${works.length}`,
      );
    }
    allWorks.push(...works);
  }

  const unregistered = onDiskFiles.filter((file) => !declaredFiles.has(file));

  const contentIdMap = new Map();
  const productIdMap = new Map();
  const normContentMap = new Map();
  const normProductMap = new Map();
  let noId = 0;
  let noImage = 0;

  allWorks.forEach((work, index) => {
    const cid = String(work.content_id ?? "").trim().toLowerCase();
    const pid = String(work.product_id ?? "").trim().toLowerCase();
    const ncid = normalizeWorkId(work.content_id);
    const npid = normalizeWorkId(work.product_id);

    if (!cid && !pid) noId += 1;
    if (!hasImage(work)) noImage += 1;

    if (cid) {
      const bucket = contentIdMap.get(cid) ?? [];
      bucket.push(index);
      contentIdMap.set(cid, bucket);
    }
    if (pid) {
      const bucket = productIdMap.get(pid) ?? [];
      bucket.push(index);
      productIdMap.set(pid, bucket);
    }
    if (ncid) {
      const bucket = normContentMap.get(ncid) ?? [];
      bucket.push(index);
      normContentMap.set(ncid, bucket);
    }
    if (npid) {
      const bucket = normProductMap.get(npid) ?? [];
      bucket.push(index);
      normProductMap.set(npid, bucket);
    }
  });

  function dupCount(map) {
    return [...map.values()].filter((indices) => indices.length > 1).length;
  }

  const contentIdDupes = dupCount(contentIdMap);
  const productIdDupes = dupCount(productIdMap);
  const normContentDupes = dupCount(normContentMap);
  const normProductDupes = dupCount(normProductMap);
  const totalDupes =
    contentIdDupes + productIdDupes + normContentDupes + normProductDupes;

  const shardTotal = allWorks.length;
  const manifestTotal = Number(manifest.totalCount) || 0;
  const countMismatchFiles = declaredShards.filter((entry) => {
    const filePath = path.join(shardDir, entry.file);
    if (!existsSync(filePath)) return false;
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf8"));
      const works = normalizeCatalogWorks(raw);
      return works.length !== entry.count;
    } catch {
      return true;
    }
  });

  const hardFailures = [];
  if (manifestTotal !== shardTotal) {
    hardFailures.push(
      `totalCount mismatch manifest=${manifestTotal} shardTotal=${shardTotal}`,
    );
  }
  if (missingFiles.length > 0) {
    hardFailures.push(`missing files: ${missingFiles.join(", ")}`);
  }
  if (unregistered.length > 0) {
    hardFailures.push(`unregistered shards: ${unregistered.join(", ")}`);
  }
  if (invalidFiles.length > 0) {
    hardFailures.push(`invalid files: ${invalidFiles.join(", ")}`);
  }
  if (oversizeShards.length > 0) {
    hardFailures.push(`shardSize exceeded: ${oversizeShards.join(", ")}`);
  }
  if (contentIdDupes > 0 || normContentDupes > 0) {
    hardFailures.push(
      `content_id duplicates: raw=${contentIdDupes} norm=${normContentDupes}`,
    );
  }
  if (countMismatchFiles.length > 0) {
    hardFailures.push(
      `manifest count mismatch: ${countMismatchFiles.map((e) => e.file).join(", ")}`,
    );
  }

  // 空shardは警告（先頭以外は原則禁止だが初期空は許容しない）
  if (emptyShards.length > 0 && shardTotal > 0) {
    hardFailures.push(`empty shards: ${emptyShards.join(", ")}`);
  }

  console.log("Catalog verification passed".replace(
    "passed",
    hardFailures.length === 0 ? "passed" : "FAILED",
  ));
  console.log("");
  console.log(`manifest total：${manifestTotal.toLocaleString()}`);
  console.log(`shard total：${shardTotal.toLocaleString()}`);
  console.log(`shards：${declaredShards.length}`);
  console.log(`duplicates：${totalDupes}`);
  console.log(`  content_id：${contentIdDupes}`);
  console.log(`  product_id：${productIdDupes}`);
  console.log(`  norm content_id：${normContentDupes}`);
  console.log(`  norm product_id：${normProductDupes}`);
  console.log(`missing files：${missingFiles.length}`);
  console.log(`invalid files：${invalidFiles.length}`);
  console.log(`unregistered shards：${unregistered.length}`);
  console.log(`empty shards：${emptyShards.length}`);
  console.log(`oversize shards：${oversizeShards.length}`);
  console.log(`no-id works：${noId}`);
  console.log(`no-image works：${noImage}`);

  if (hardFailures.length > 0) {
    console.error("");
    for (const message of hardFailures) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  // product_id 重複のみは情報として残し、build は通す（同一商品の content 違いがあり得る）
  // ただし content_id 正規化重複は hard fail 済み
}

main();
