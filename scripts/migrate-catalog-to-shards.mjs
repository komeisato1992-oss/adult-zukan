#!/usr/bin/env node
/**
 * catalog-snapshot.json を data/dmm/catalog/ 配下の shard 群へ移行する。
 *
 * 用法:
 *   node scripts/migrate-catalog-to-shards.mjs --dry-run
 *   node scripts/migrate-catalog-to-shards.mjs --apply
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCatalogShards,
  CATALOG_LEGACY_BACKUP_RELATIVE,
  CATALOG_LEGACY_SNAPSHOT_RELATIVE,
  CATALOG_MANIFEST_RELATIVE,
  CATALOG_SHARD_DIR_RELATIVE,
  DEFAULT_SHARD_SIZE,
  normalizeCatalogWorks,
  serializeJsonPretty,
} from "../lib/dmm/catalog-shard-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    shardSize: DEFAULT_SHARD_SIZE,
    source: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
    } else if (arg === "--shard-size" && argv[i + 1]) {
      args.shardSize = Number(argv[++i]);
    } else if (arg === "--source" && argv[i + 1]) {
      args.source = path.resolve(ROOT, argv[++i]);
    }
  }

  if (!args.source) {
    const candidates = [
      path.join(ROOT, CATALOG_LEGACY_SNAPSHOT_RELATIVE),
      path.join(ROOT, CATALOG_LEGACY_BACKUP_RELATIVE),
    ];
    args.source =
      candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);

  if (!existsSync(args.source)) {
    console.error(`Source not found: ${args.source}`);
    process.exit(1);
  }

  const rawText = readFileSync(args.source, "utf8");
  const raw = JSON.parse(rawText);
  const originalWorks = normalizeCatalogWorks(raw);
  const originalCount = Array.isArray(raw)
    ? raw.length
    : originalWorks.length;

  const { manifest, shards, works, stats } = buildCatalogShards({
    works: originalWorks,
    shardSize: args.shardSize,
  });

  const shardDir = path.join(ROOT, CATALOG_SHARD_DIR_RELATIVE);
  const plannedFiles = [
    {
      relative: CATALOG_MANIFEST_RELATIVE,
      bytes: Buffer.byteLength(serializeJsonPretty(manifest), "utf8"),
      count: null,
    },
    ...shards.map((shard) => ({
      relative: path.posix.join(CATALOG_SHARD_DIR_RELATIVE, shard.file),
      bytes: Buffer.byteLength(serializeJsonPretty(shard.works), "utf8"),
      count: shard.count,
    })),
  ];

  console.log("=== catalog shard migration ===");
  console.log(`mode: ${args.apply ? "apply" : "dry-run"}`);
  console.log(`source: ${path.relative(ROOT, args.source)}`);
  console.log(`source bytes: ${Buffer.byteLength(rawText, "utf8").toLocaleString()}`);
  console.log(`元catalog件数: ${originalCount.toLocaleString()}`);
  console.log(`有効作品数: ${originalWorks.length.toLocaleString()}`);
  console.log(`重複グループ数: ${stats.duplicateGroups.toLocaleString()}`);
  console.log(`重複除外数: ${stats.removedCount.toLocaleString()}`);
  console.log(`shard数: ${shards.length}`);
  console.log(`shardSize: ${manifest.shardSize}`);
  console.log(`修正後総件数: ${manifest.totalCount.toLocaleString()}`);
  console.log("");
  console.log("想定ファイル一覧:");
  for (const file of plannedFiles) {
    const countLabel =
      file.count == null ? "manifest" : `${file.count.toLocaleString()}件`;
    console.log(
      `  - ${file.relative}  (${countLabel}, ${file.bytes.toLocaleString()} bytes)`,
    );
  }

  if (args.dryRun) {
    console.log("");
    console.log("dry-run complete (no files written)");
    return;
  }

  mkdirSync(shardDir, { recursive: true });
  writeFileSync(
    path.join(ROOT, CATALOG_MANIFEST_RELATIVE),
    serializeJsonPretty(manifest),
    "utf8",
  );

  for (const shard of shards) {
    writeFileSync(
      path.join(shardDir, shard.file),
      serializeJsonPretty(shard.works),
      "utf8",
    );
  }

  const backupPath = path.join(ROOT, CATALOG_LEGACY_BACKUP_RELATIVE);
  if (!existsSync(backupPath)) {
    copyFileSync(args.source, backupPath);
    console.log(`backup created: ${CATALOG_LEGACY_BACKUP_RELATIVE}`);
  } else {
    console.log(`backup already exists: ${CATALOG_LEGACY_BACKUP_RELATIVE}`);
  }

  // 旧ファイルは残す（ローダー切替確認後に非推奨化）。削除しない。
  console.log("");
  console.log("apply complete");
  console.log(`manifest: ${CATALOG_MANIFEST_RELATIVE}`);
  console.log(`shards: ${shards.length}`);
  console.log(`totalCount: ${manifest.totalCount}`);
  console.log(
    `legacy snapshot kept at: ${CATALOG_LEGACY_SNAPSHOT_RELATIVE} (do not dual-load)`,
  );
}

main();
