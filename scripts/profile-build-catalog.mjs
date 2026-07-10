#!/usr/bin/env node
/**
 * ビルド前のカタログ処理コストを計測（Next.js ビルド外）
 */
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const SNAPSHOT = path.join(ROOT, "data/dmm/catalog-snapshot.json");

function time(label, fn) {
  console.time(label);
  const result = fn();
  console.timeEnd(label);
  return result;
}

async function timeAsync(label, fn) {
  console.time(label);
  const result = await fn();
  console.timeEnd(label);
  return result;
}

async function main() {
  console.log("=== Catalog build profile ===");
  if (!existsSync(SNAPSHOT)) {
    console.log("catalog-snapshot.json not found");
    process.exit(1);
  }

  const sizeBytes = statSync(SNAPSHOT).size;
  console.log("snapshot size:", `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);

  let parseCount = 0;
  const rawText = time("read-catalog-file", () => readFileSync(SNAPSHOT, "utf-8"));

  const items = time("catalog-parse", () => {
    parseCount += 1;
    const raw = JSON.parse(rawText);
    return Array.isArray(raw) ? raw : raw.works ?? [];
  });

  console.log("snapshot items:", items.length);

  // simulate 3x parse (typical duplicate reads without cache)
  time("catalog-parse-x3-simulated", () => {
    for (let i = 0; i < 3; i++) {
      JSON.parse(rawText);
      parseCount += 1;
    }
  });

  const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|$)/i;
  function isValidImageUrl(url) {
    const t = url?.trim();
    if (!t) return false;
    const l = t.toLowerCase();
    if (["now_printing", "nowprinting", "noimage"].some((k) => l.includes(k))) return false;
    return IMAGE_EXTENSIONS.test(t);
  }
  function isValid(item) {
    if (!item.content_id?.trim() || !item.title?.trim()) return false;
    if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
    if (item.content_id?.toLowerCase().startsWith("vr")) return false;
    const img = item.imageURL?.large || item.imageURL?.list;
    return Boolean(img && isValidImageUrl(img));
  }

  const valid = time("filter-valid-items", () => items.filter(isValid));
  console.log("valid items:", valid.length);

  time("generate-static-params-works", () =>
    valid.map((i) => ({ slug: i.content_id })),
  );
  console.log("static params works count:", valid.length);

  const actressMap = new Map();
  for (const item of valid) {
    for (const a of item.actress ?? item.iteminfo?.actress ?? []) {
      if (!a.name) continue;
      actressMap.set(a.name, (actressMap.get(a.name) ?? 0) + 1);
    }
  }
  console.log("static params actresses (estimate):", actressMap.size);

  const makerSet = new Set();
  for (const item of valid) {
    const m = item.maker?.[0]?.name ?? item.iteminfo?.maker?.[0]?.name;
    if (m) makerSet.add(m);
  }
  console.log("static params makers (estimate):", makerSet.size);

  console.log("simulated JSON.parse count (no cache):", parseCount);
  console.log("\n推定: generateStaticParams(works) が", valid.length, "ページ分の SSG を発生");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
