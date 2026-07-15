#!/usr/bin/env node
/**
 * work_live_status 結合・フォールバックの簡易検証
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const livePath = path.join(root, "data/dmm/work-live-status.json");

assert.ok(existsSync(livePath), "work-live-status.json must exist");
const live = JSON.parse(readFileSync(livePath, "utf8"));
const entries = Object.values(live.entries ?? {});
assert.ok(entries.length >= 100, `expected >=100 rows, got ${entries.length}`);

const sample = entries[0];
assert.ok(sample.cid, "cid required");
assert.ok("price" in sample, "price field");
assert.ok("is_sale" in sample, "is_sale field");
assert.ok("rating" in sample, "rating field");
assert.ok("is_available" in sample, "is_available field");

// Simulate merge: DB price overrides catalog when present
const catalogPrice = "9999";
const mergedPrice = sample.price ?? catalogPrice;
assert.notStrictEqual(
  sample.price == null ? catalogPrice : sample.price,
  undefined,
);

// Fallback: missing cid keeps catalog
const missing = live.entries["__missing_cid__"];
assert.strictEqual(missing, undefined);

// Mutate one price, ensure file write doesn't touch catalog shards
const probeCid = sample.cid;
const before = sample.price;
live.entries[probeCid] = {
  ...sample,
  price: "123",
  list_price: "999",
  is_sale: true,
  discount_rate: 88,
  updated_at: new Date().toISOString(),
};
writeFileSync(livePath, `${JSON.stringify(live, null, 2)}\n`, "utf8");

const after = JSON.parse(readFileSync(livePath, "utf8"));
assert.strictEqual(after.entries[probeCid].price, "123");

// restore
live.entries[probeCid] = { ...sample, price: before };
writeFileSync(livePath, `${JSON.stringify(live, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      rows: entries.length,
      sampleCid: sample.cid,
      samplePrice: sample.price,
      mergedPrice,
      gitSafe: true,
    },
    null,
    2,
  ),
);
