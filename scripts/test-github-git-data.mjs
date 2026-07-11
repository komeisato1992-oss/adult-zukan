#!/usr/bin/env node
/**
 * GitHub カタログ保存が Git Data API を使うことを検証
 * 実行: node scripts/test-github-git-data.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
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

const addSelected = readFileSync(
  path.join(root, "lib/admin/add-selected-works.ts"),
  "utf8",
);
assert.match(addSelected, /commitCatalogBundleToGitHub/);
assert.match(addSelected, /precommit-refetch/);
assert.doesNotMatch(addSelected, /method:\s*"PUT"/);

const catalogPath = path.join(root, "data/dmm/catalog-snapshot.json");
const catalogBytes = statSync(catalogPath).size;
const catalogItems = JSON.parse(readFileSync(catalogPath, "utf8"));
const itemCount = Array.isArray(catalogItems)
  ? catalogItems.length
  : catalogItems.works?.length ?? 0;
const est30k = Math.round((catalogBytes / itemCount) * 30000);

console.log("catalog bytes:", catalogBytes.toLocaleString());
console.log("catalog items:", itemCount.toLocaleString());
console.log("estimated 30k bytes:", est30k.toLocaleString());
console.log(
  "estimated 30k MB:",
  (est30k / 1024 / 1024).toFixed(1),
);

assert.ok(
  catalogBytes < 100 * 1024 * 1024,
  "current catalog must stay under GitHub 100MB blob limit",
);

if (est30k > 100 * 1024 * 1024) {
  console.warn(
    "WARN: 30,000 items may exceed GitHub blob 100MB limit; catalog split or DB migration will be needed.",
  );
}

console.log("test-github-git-data: all checks passed");
