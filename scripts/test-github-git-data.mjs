#!/usr/bin/env node
/**
 * GitHub カタログ保存が Git Data API + shard 方式であることを検証
 * 実行: node scripts/test-github-git-data.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const githubCatalog = readFileSync(
  path.join(root, "lib/admin/github-catalog.ts"),
  "utf8",
);

assert.doesNotMatch(
  githubCatalog,
  /method:\s*"PUT"/,
  "github-catalog.ts must not use Contents API PUT for commits",
);

assert.match(githubCatalog, /\/git\/blobs/);
assert.match(githubCatalog, /\/git\/trees/);
assert.match(githubCatalog, /\/git\/commits/);
assert.match(githubCatalog, /\/git\/refs\/heads\//);
assert.match(githubCatalog, /commitGitDataBundle/);
assert.match(githubCatalog, /encoding: "base64"/);
assert.match(githubCatalog, /create-catalog-blob/);
assert.match(githubCatalog, /force: false/);
assert.match(
  githubCatalog,
  /単一巨大 catalog-snapshot\.json への保存は禁止/,
);

const addSelected = readFileSync(
  path.join(root, "lib/admin/add-selected-works.ts"),
  "utf8",
);
assert.match(addSelected, /commitCatalogShardAppendToGitHub/);
assert.match(addSelected, /precommit-refetch/);
assert.doesNotMatch(addSelected, /method:\s*"PUT"/);
assert.doesNotMatch(addSelected, /commitCatalogBundleToGitHub/);

const shardDir = path.join(root, "data/dmm/catalog");
const manifestPath = path.join(shardDir, "manifest.json");
assert.ok(existsSync(manifestPath), "manifest.json must exist");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const shardFiles = readdirSync(shardDir).filter((name) =>
  /^catalog-\d+\.json$/i.test(name),
);

let maxShardBytes = 0;
for (const file of shardFiles) {
  maxShardBytes = Math.max(
    maxShardBytes,
    statSync(path.join(shardDir, file)).size,
  );
}

console.log("manifest totalCount:", manifest.totalCount.toLocaleString());
console.log("shards:", shardFiles.length);
console.log("max shard bytes:", maxShardBytes.toLocaleString());
console.log(
  "max shard MB:",
  (maxShardBytes / 1024 / 1024).toFixed(2),
);

assert.ok(
  maxShardBytes < 10 * 1024 * 1024,
  "each shard must stay well under GitHub blob limits",
);
assert.ok(
  !existsSync(path.join(root, "data/dmm/catalog-snapshot.json")),
  "active catalog-snapshot.json must not exist (use shards only)",
);

console.log("test-github-git-data: all checks passed");
