#!/usr/bin/env node
/**
 * catalog-snapshot.json の重複作品を調査・削除する
 *
 * dry-run:
 *   node scripts/dedupe-catalog.mjs --dry-run
 *
 * apply（バックアップ作成後に上書き）:
 *   node scripts/dedupe-catalog.mjs --apply
 */
import assert from "node:assert/strict";
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
  analyzeCatalogDuplicates,
  dedupeCatalogWorks,
} from "../lib/dmm/catalog-dedupe-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "data/dmm/catalog-snapshot.json");
const backupDir = path.join(root, "data/dmm/backups");

const args = new Set(process.argv.slice(2));
const isApply = args.has("--apply");
const isDryRun = args.has("--dry-run") || !isApply;

if (!isDryRun && !isApply) {
  console.error("Usage: node scripts/dedupe-catalog.mjs [--dry-run|--apply]");
  process.exit(1);
}

const WRAPPER_KEYS = ["works", "items", "catalog", "data", "products"];

function parseJsonMaybe(value) {
  let data = value;
  for (let i = 0; i < 2; i += 1) {
    if (typeof data !== "string") break;
    try {
      data = JSON.parse(data);
    } catch {
      break;
    }
  }
  return data;
}

function extractEnvelope(raw) {
  const parsed = parseJsonMaybe(raw);
  if (Array.isArray(parsed)) {
    return {
      format: "array",
      items: parsed,
      save: (items) => items,
    };
  }

  if (parsed && typeof parsed === "object") {
    for (const key of WRAPPER_KEYS) {
      const value = parsed[key];
      if (Array.isArray(value)) {
        return {
          format: "object",
          key,
          base: { ...parsed },
          items: value,
          save: (items) => ({
            ...parsed,
            [key]: items,
            updatedAt: new Date().toISOString(),
          }),
        };
      }
    }
  }

  throw new Error("catalog-snapshot.json の形式を判別できません。");
}

function formatGroup(group) {
  return [
    `- ${group.contentId || group.productId || "(no id)"}`,
    `  title: ${group.title || "(no title)"}`,
    `  indices: ${group.indices.join(", ")}`,
    `  keep: ${group.keepIndex}`,
    `  remove: ${group.removeIndices.join(", ") || "(none)"}`,
  ].join("\n");
}

function main() {
  assert.ok(existsSync(catalogPath), `missing ${catalogPath}`);

  const rawText = readFileSync(catalogPath, "utf8");
  const envelope = extractEnvelope(rawText);
  const analysis = analyzeCatalogDuplicates(envelope.items);
  const { stats, items: dedupedItems } = analysis.deduped;

  console.log("=== Catalog Duplicate Analysis ===");
  console.log(`catalog総件数: ${analysis.catalogTotal.toLocaleString()}`);
  console.log(
    `content_id完全一致の重複組数: ${analysis.contentIdDuplicateGroups}`,
  );
  console.log(
    `product_id完全一致の重複組数: ${analysis.productIdDuplicateGroups}`,
  );
  console.log(
    `正規化content_id重複組数: ${analysis.normalizedContentIdDuplicateGroups}`,
  );
  console.log(
    `正規化product_id重複組数: ${analysis.normalizedProductIdDuplicateGroups}`,
  );
  console.log(
    `identity重複組数: ${analysis.identityDuplicateGroups}`,
  );
  console.log(
    `重複作品の総削除候補件数: ${analysis.identityRemoveCandidates}`,
  );
  console.log("");
  console.log("=== Dedupe Plan ===");
  console.log(`元件数: ${stats.originalCount.toLocaleString()}`);
  console.log(`重複グループ数: ${stats.duplicateGroups.toLocaleString()}`);
  console.log(`削除予定件数: ${stats.removedCount.toLocaleString()}`);
  console.log(`マージ件数: ${stats.mergedCount.toLocaleString()}`);
  console.log(`修正後想定件数: ${stats.dedupedCount.toLocaleString()}`);
  console.log("");

  if (analysis.topGroups.length > 0) {
    console.log("=== Top Duplicate Groups ===");
    for (const group of analysis.topGroups) {
      console.log(formatGroup(group));
    }
    console.log("");
  }

  const hhkl = analysis.topGroups.find((group) =>
    group.contentId.toLowerCase().includes("hhkl00013"),
  );
  if (hhkl) {
    console.log("=== hhkl00013 ===");
    console.log(formatGroup(hhkl));
    console.log("");
  }

  if (isDryRun) {
    console.log("dry-run complete. catalog was not modified.");
    return;
  }

  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `catalog-snapshot-${timestamp}.json`,
  );
  copyFileSync(catalogPath, backupPath);
  console.log(`backup: ${backupPath}`);

  const saveData = envelope.save(dedupedItems);
  writeFileSync(catalogPath, `${JSON.stringify(saveData, null, 2)}\n`, "utf8");
  console.log(`applied deduped catalog: ${catalogPath}`);
  console.log(
    "note: 関連インデックスは npm run build または管理画面の追加処理で再生成してください。",
  );
}

main();
