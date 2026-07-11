#!/usr/bin/env node
/**
 * ローカル shard への追加を検証する（GitHub API なし）。
 *
 * 用法:
 *   CATALOG_ADD_LOCAL=1 node scripts/test-catalog-shard-add.mjs
 *
 * オプション:
 *   --counts 1,10,50,100,500
 *   --restore   テスト後に検証前の状態へ戻す
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendWorksToLastShards,
  buildCatalogIdSetFromWorks,
  CATALOG_MANIFEST_RELATIVE,
  CATALOG_SHARD_DIR_RELATIVE,
  normalizeCatalogWorks,
  serializeJsonPretty,
  workMatchesCatalogIds,
} from "../lib/dmm/catalog-shard-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SHARD_DIR = path.join(ROOT, CATALOG_SHARD_DIR_RELATIVE);
const MANIFEST_PATH = path.join(ROOT, CATALOG_MANIFEST_RELATIVE);
const BACKUP_DIR = path.join(ROOT, "data/dmm/.catalog-test-backup");

function parseArgs(argv) {
  const args = {
    counts: [1, 10, 50, 100, 500],
    restore: false,
    skipRestore: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--counts" && argv[i + 1]) {
      args.counts = argv[++i].split(",").map((v) => Number(v.trim()));
    } else if (arg === "--restore") {
      args.restore = true;
    } else if (arg === "--keep") {
      args.skipRestore = true;
    }
  }
  return args;
}

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function loadAllWorks(manifest) {
  const works = [];
  for (const entry of manifest.shards) {
    const raw = JSON.parse(
      readFileSync(path.join(SHARD_DIR, entry.file), "utf8"),
    );
    works.push(...normalizeCatalogWorks(raw));
  }
  return works;
}

function backupCatalog() {
  if (existsSync(BACKUP_DIR)) {
    rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  copyFileSync(MANIFEST_PATH, path.join(BACKUP_DIR, "manifest.json"));
  for (const file of readdirSync(SHARD_DIR)) {
    if (!file.endsWith(".json")) continue;
    copyFileSync(path.join(SHARD_DIR, file), path.join(BACKUP_DIR, file));
  }
}

function restoreCatalog() {
  if (!existsSync(BACKUP_DIR)) {
    throw new Error("backup not found");
  }
  for (const file of readdirSync(SHARD_DIR)) {
    if (file.endsWith(".json")) {
      rmSync(path.join(SHARD_DIR, file), { force: true });
    }
  }
  for (const file of readdirSync(BACKUP_DIR)) {
    copyFileSync(path.join(BACKUP_DIR, file), path.join(SHARD_DIR, file));
  }
}

function makeFakeWorks(count, seed) {
  const works = [];
  for (let i = 0; i < count; i += 1) {
    const id = `testshard${seed}${String(i).padStart(5, "0")}`;
    works.push({
      content_id: id,
      product_id: id,
      title: `Shard Test Work ${seed}-${i}`,
      imageURL: {
        large: `https://example.com/${id}.jpg`,
        list: `https://example.com/${id}_list.jpg`,
      },
      URL: `https://example.com/works/${id}`,
      affiliateURL: `https://example.com/aff/${id}`,
      date: "2026-07-01",
      prices: { price: "500" },
      iteminfo: {
        actress: [{ name: "テスト女優" }],
        maker: [{ name: "テストメーカー" }],
      },
    });
  }
  return works;
}

function appendLocal(newWorks) {
  const manifest = loadManifest();
  const allWorks = loadAllWorks(manifest);
  const catalogKeys = buildCatalogIdSetFromWorks(allWorks);

  const unique = [];
  let duplicateCount = 0;
  const batchKeys = new Set();
  for (const work of newWorks) {
    if (
      workMatchesCatalogIds(work, catalogKeys) ||
      workMatchesCatalogIds(work, batchKeys)
    ) {
      duplicateCount += 1;
      continue;
    }
    for (const key of buildCatalogIdSetFromWorks([work])) {
      batchKeys.add(key);
    }
    unique.push(work);
  }

  if (unique.length === 0) {
    return {
      addedCount: 0,
      duplicateCount,
      updatedShardFiles: [],
      newShardFiles: [],
      totalCount: manifest.totalCount,
      maxBlobBytes: 0,
      committedFiles: [],
    };
  }

  const lastMeta = manifest.shards[manifest.shards.length - 1];
  const lastShardWorks = lastMeta
    ? normalizeCatalogWorks(
        JSON.parse(readFileSync(path.join(SHARD_DIR, lastMeta.file), "utf8")),
      )
    : [];

  const append = appendWorksToLastShards(manifest, lastShardWorks, unique);
  writeFileSync(
    MANIFEST_PATH,
    serializeJsonPretty(append.manifest),
    "utf8",
  );

  let maxBlobBytes = Buffer.byteLength(
    serializeJsonPretty(append.manifest),
    "utf8",
  );
  const committedFiles = [CATALOG_MANIFEST_RELATIVE];

  for (const shard of append.changedShards) {
    const content = serializeJsonPretty(shard.works);
    const bytes = Buffer.byteLength(content, "utf8");
    maxBlobBytes = Math.max(maxBlobBytes, bytes);
    writeFileSync(path.join(SHARD_DIR, shard.file), content, "utf8");
    committedFiles.push(`${CATALOG_SHARD_DIR_RELATIVE}/${shard.file}`);
  }

  // 他 shard を書き直していないことを確認
  const changedSet = new Set(append.changedShards.map((s) => s.file));
  for (const entry of manifest.shards) {
    if (changedSet.has(entry.file)) continue;
    // untouched
  }

  return {
    addedCount: unique.length,
    duplicateCount,
    updatedShardFiles: append.updatedShardFiles,
    newShardFiles: append.newShardFiles,
    totalCount: append.manifest.totalCount,
    maxBlobBytes,
    committedFiles,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(MANIFEST_PATH)) {
    console.error("manifest not found. Run migrate --apply first.");
    process.exit(1);
  }

  backupCatalog();
  const before = loadManifest();
  console.log("=== catalog shard add local test ===");
  console.log(`before totalCount: ${before.totalCount}`);
  console.log(`before shards: ${before.shards.length}`);

  const results = [];
  let seed = Date.now() % 100000;

  for (const count of args.counts) {
    const fake = makeFakeWorks(count, seed);
    seed += 1;
    const result = appendLocal(fake);
    const ok =
      result.addedCount === count &&
      result.maxBlobBytes < 10 * 1024 * 1024 &&
      result.committedFiles.every(
        (file) =>
          file === CATALOG_MANIFEST_RELATIVE ||
          file.startsWith(`${CATALOG_SHARD_DIR_RELATIVE}/`),
      );

    console.log("");
    console.log(`--- add ${count} ---`);
    console.log(`added: ${result.addedCount}`);
    console.log(`duplicates: ${result.duplicateCount}`);
    console.log(`updated shards: ${result.updatedShardFiles.join(", ") || "-"}`);
    console.log(`new shards: ${result.newShardFiles.join(", ") || "-"}`);
    console.log(`totalCount: ${result.totalCount}`);
    console.log(`max blob bytes: ${result.maxBlobBytes}`);
    console.log(`committed files: ${result.committedFiles.join(", ")}`);
    console.log(`ok: ${ok}`);

    results.push({ count, ...result, ok });

    // 同じ件を再追加 → 重複のみ
    const dup = appendLocal(fake);
    const dupOk = dup.addedCount === 0 && dup.duplicateCount === count;
    console.log(`re-add duplicates: ${dup.duplicateCount} (ok=${dupOk})`);
    results.push({
      count: `re-${count}`,
      ...dup,
      ok: dupOk,
    });
  }

  const allOk = results.every((entry) => entry.ok);
  console.log("");
  console.log(allOk ? "ALL TESTS PASSED" : "SOME TESTS FAILED");

  if (!args.skipRestore) {
    restoreCatalog();
    console.log("catalog restored from backup");
  } else {
    console.log("catalog kept (--keep)");
  }

  process.exit(allOk ? 0 : 1);
}

main();
