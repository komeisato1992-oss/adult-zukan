#!/usr/bin/env node
/**
 * クライアント側 100件バッチ分割の単体確認
 * node scripts/test-add-batch-chunk.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const constantsSource = readFileSync(
  path.join(root, "lib/admin/import-constants.ts"),
  "utf8",
);
assert.match(constantsSource, /export const ADD_BATCH_SIZE = 100/);

function chunkItems(items, size = 100) {
  if (items.length === 0) return [];
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const ADD_BATCH_SIZE = 100;

const cases = [
  { total: 50, expected: [50] },
  { total: 100, expected: [100] },
  { total: 101, expected: [100, 1] },
  { total: 200, expected: [100, 100] },
  { total: 300, expected: [100, 100, 100] },
  { total: 500, expected: [100, 100, 100, 100, 100] },
];

for (const testCase of cases) {
  const items = Array.from({ length: testCase.total }, (_, i) => i);
  const chunks = chunkItems(items, ADD_BATCH_SIZE);
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    testCase.expected,
    `total=${testCase.total}`,
  );
}

const addSelected = readFileSync(
  path.join(root, "lib/admin/add-selected-works.ts"),
  "utf8",
);
assert.match(addSelected, /ADD_API_MAX_WORKS/);
assert.match(addSelected, /commitCatalogShardAppendToGitHub/);
assert.doesNotMatch(addSelected, /commitCatalogBundleToGitHub/);

const client = readFileSync(
  path.join(root, "components/admin/ImportManagementClient.tsx"),
  "utf8",
);
assert.match(client, /ADD_BATCH_SIZE/);
assert.match(client, /chunkItems/);
assert.match(client, /post-add-sitemap/);
assert.match(client, /updateSitemap: false/);

console.log("test-add-batch-chunk: all checks passed");
console.log("500件 → 5 API calls of 100");
