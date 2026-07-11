#!/usr/bin/env node
/**
 * 簡易インポートのクライアント側ロジック検証
 * 実行: node scripts/test-import-simple.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function normalizeWorkId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

assert.equal(normalizeWorkId("START-00319"), "start00319");
assert.equal(normalizeWorkId("h_491start00319"), "h491start00319");
assert.equal(normalizeWorkId("  ABC-123  "), "abc123");

const constantsSource = readFileSync(
  path.join(root, "lib/admin/import-constants.ts"),
  "utf8",
);
assert.match(constantsSource, /IMPORT_FETCH_REQUEST_OPTIONS = \[10, 20, 50, 100, 200, 300, 500\]/);
assert.match(constantsSource, /IMPORT_FETCH_REQUEST_DEFAULT = 50/);
assert.match(constantsSource, /IMPORT_FETCH_MAX_SCAN_MULTIPLIER = 3/);
assert.match(constantsSource, /IMPORT_SIMPLE_ADD_MAX_RETRIES = 2/);

const fetchRoute = readFileSync(
  path.join(root, "app/api/admin/import/fetch-candidates/route.ts"),
  "utf8",
);
assert.doesNotMatch(fetchRoute, /commit|PUT|saveImport|markImport/i);

const addRoute = readFileSync(
  path.join(root, "app/api/admin/import/add-selected-works/route.ts"),
  "utf8",
);
assert.match(addRoute, /addSelectedWorksToCatalog/);
assert.doesNotMatch(addRoute, /allMatching|resolveBulkAddSelection|markImportCandidatesAdded/i);

const clientSource = readFileSync(
  path.join(root, "components/admin/ImportManagementClient.tsx"),
  "utf8",
);
assert.match(clientSource, /selectedIds/);
assert.match(clientSource, /fetch-candidates/);
assert.match(clientSource, /add-selected-works/);
assert.doesNotMatch(clientSource, /allMatching|PopularCollectPanel|batchJob/i);

console.log("test-import-simple: all checks passed");
