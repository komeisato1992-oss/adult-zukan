#!/usr/bin/env node
/**
 * カタログ更新フィールドのオフライン検証
 * node scripts/test-catalog-refresh-fields.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  try {
    const text = readFileSync(resolve(root, filePath), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(".env.local");

const catalog = JSON.parse(
  readFileSync(resolve(root, "data/dmm/catalog-snapshot.json"), "utf8"),
);
const items = Array.isArray(catalog) ? catalog : catalog.items ?? catalog.works;
assert.ok(items.length > 0, "catalog should not be empty");

const sourceFiles = [
  "lib/dmm/catalog-refresh-fields.ts",
  "lib/dmm/work-sale-info.ts",
  "lib/admin/refresh-catalog-works.ts",
  "lib/admin/catalog-refresh-priority.ts",
  "app/api/admin/import/refresh-works/route.ts",
  "app/api/admin/import/refresh-state/route.ts",
];

for (const file of sourceFiles) {
  const text = readFileSync(resolve(root, file), "utf8");
  assert.match(text, /refresh|Refresh|getWorkSaleInfo|pickRefreshableFields/);
}

const client = readFileSync(
  resolve(root, "components/admin/ImportManagementClient.tsx"),
  "utf8",
);
assert.match(client, /掲載済み作品の最新情報更新/);
assert.match(client, /refresh-works/);

const page = readFileSync(
  resolve(root, "app/admin/(protected)/import/page.tsx"),
  "utf8",
);
assert.match(page, /未掲載作品を取得・追加/);
assert.match(page, /掲載済み作品の最新情報更新/);

console.log("test-catalog-refresh-fields: structure checks passed", {
  catalogCount: items.length,
});
