#!/usr/bin/env node
/**
 * FANZA API から作品を取得し catalog-snapshot.json に先頭追加する。
 *
 * 用法:
 *   node scripts/add-catalog-works.mjs --dry-run --target=1000 --fetch-limit=3000 --require-image
 *   node scripts/add-catalog-works.mjs --target=1000 --fetch-limit=3000 --require-image
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const ENV_FILES = [".env.local", ".env"];
const SNAPSHOT_FILE = path.join(ROOT, "data", "dmm", "catalog-snapshot.json");
const API_AFFILIATE_FALLBACK = "zukanjp-990";
const FETCH_BATCH_SIZE = 100;

const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|$)/i;
const INVALID_IMAGE_KEYWORDS = ["now_printing", "nowprinting", "noimage"];
const MONO_PLACEHOLDER_PATTERN = /(^|[/_.-])mono([/_.-]|\.|$)/i;

function parseArgs(argv) {
  const options = {
    dryRun: false,
    target: 1000,
    fetchLimit: 3000,
    requireImage: true,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--require-image") {
      options.requireImage = true;
      continue;
    }
    if (arg.startsWith("--target=")) {
      options.target = Number.parseInt(arg.slice("--target=".length), 10);
      continue;
    }
    if (arg.startsWith("--fetch-limit=")) {
      options.fetchLimit = Number.parseInt(arg.slice("--fetch-limit=".length), 10);
    }
  }

  if (!Number.isFinite(options.target) || options.target <= 0) {
    throw new Error("--target は正の整数を指定してください。");
  }
  if (!Number.isFinite(options.fetchLimit) || options.fetchLimit <= 0) {
    throw new Error("--fetch-limit は正の整数を指定してください。");
  }

  return options;
}

function loadEnvFiles() {
  for (const file of ENV_FILES) {
    const filePath = path.join(ROOT, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function isValidImageUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (INVALID_IMAGE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false;
  }
  if (MONO_PLACEHOLDER_PATTERN.test(trimmed)) {
    return false;
  }
  return IMAGE_EXTENSIONS.test(trimmed);
}

function hasValidImage(item) {
  if (!item.imageURL) return false;
  return [item.imageURL.large, item.imageURL.list, item.imageURL.small].some(
    isValidImageUrl,
  );
}

function getValidImageUrl(item, order = ["large", "list", "small"]) {
  if (!item.imageURL) return undefined;
  for (const key of order) {
    const url = item.imageURL[key];
    if (isValidImageUrl(url)) return url.trim();
  }
  return undefined;
}

function isVrItem(item) {
  if (item.content_id?.toLowerCase().startsWith("vr")) return true;
  if (item.title?.includes("【VR】") || item.title?.includes("[VR]")) return true;
  const genres = item.iteminfo?.genre ?? [];
  return genres.some((genre) => /VR/i.test(genre.name));
}

function getDmmFanzaUrl(item) {
  if (item.URL) return item.URL;
  if (item.affiliateURL) return item.affiliateURL;
  return "";
}

function isValidDmmListItem(item) {
  if (!item.content_id?.trim()) return false;
  if (!item.title?.trim()) return false;
  if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
  if (isVrItem(item)) return false;
  if (!hasValidImage(item)) return false;
  if (!getDmmFanzaUrl(item)) return false;
  return Boolean(getValidImageUrl(item, ["large", "list"]));
}

function extractSnapshotItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const key of ["works", "items", "catalog", "data", "products"]) {
      if (Array.isArray(raw[key])) return raw[key];
    }
  }
  return [];
}

function detectSnapshotEnvelope(raw) {
  if (Array.isArray(raw)) return { format: "array" };
  if (raw && typeof raw === "object") {
    for (const key of ["works", "items", "catalog", "data", "products"]) {
      if (Array.isArray(raw[key])) {
        return { format: "object", key, base: raw };
      }
    }
  }
  return { format: "array" };
}

function buildSnapshotOutput(envelope, mergedItems, originalRaw) {
  if (envelope.format === "array") return mergedItems;
  if (envelope.format === "object") {
    return {
      ...envelope.base,
      [envelope.key]: mergedItems,
      updatedAt: new Date().toISOString(),
    };
  }
  return mergedItems;
}

function loadSnapshot() {
  if (!existsSync(SNAPSHOT_FILE)) {
    return { items: [], envelope: { format: "array" }, raw: [] };
  }

  const raw = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8"));
  return {
    items: extractSnapshotItems(raw),
    envelope: detectSnapshotEnvelope(raw),
    raw,
  };
}

async function fetchPage({ apiId, affiliateId, offset, sort }) {
  const url = new URL("https://api.dmm.com/affiliate/v3/ItemList");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", "videoa");
  url.searchParams.set("output", "json");
  url.searchParams.set("hits", String(FETCH_BATCH_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", sort);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  if (String(data.result?.status) !== "200") {
    throw new Error(`API status ${data.result?.status}`);
  }
  return data.result.items ?? [];
}

function normalizeContentId(value) {
  return value?.trim().toLowerCase() ?? "";
}

async function fetchCandidates({ fetchLimit }) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID ?? API_AFFILIATE_FALLBACK;
  if (!apiId) {
    throw new Error("DMM_API_ID が .env.local に必要です");
  }

  const sorts = ["rank", "date"];
  const seen = new Set();
  const fetched = [];
  let fanzaFetched = 0;

  for (const sort of sorts) {
    for (let offset = 1; fetched.length < fetchLimit; offset += FETCH_BATCH_SIZE) {
      let pageItems = [];
      try {
        pageItems = await fetchPage({ apiId, affiliateId, offset, sort });
      } catch (error) {
        console.warn(`[${sort}] offset=${offset} 取得失敗: ${error.message}`);
        break;
      }

      if (pageItems.length === 0) break;
      fanzaFetched += pageItems.length;

      for (const item of pageItems) {
        const id = normalizeContentId(item.content_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        fetched.push(item);
        if (fetched.length >= fetchLimit) break;
      }

      console.log(
        `[${sort}] offset=${offset} ユニーク取得=${fetched.length}/${fetchLimit}`,
      );

      if (fetched.length >= fetchLimit) break;
      if (pageItems.length < FETCH_BATCH_SIZE) break;
    }

    if (fetched.length >= fetchLimit) break;
  }

  return { fetched, fanzaFetched };
}

function selectAdditions({ fetched, existingIds, target, requireImage }) {
  const stats = {
    fanzaFetched: fetched.length,
    duplicateExcluded: 0,
    noImageExcluded: 0,
    invalidExcluded: 0,
    finalAddCount: 0,
  };
  const additions = [];

  for (const item of fetched) {
    const id = normalizeContentId(item.content_id);
    if (!id) {
      stats.invalidExcluded += 1;
      continue;
    }

    if (existingIds.has(id)) {
      stats.duplicateExcluded += 1;
      continue;
    }

    if (requireImage && !hasValidImage(item)) {
      stats.noImageExcluded += 1;
      continue;
    }

    if (!isValidDmmListItem(item)) {
      stats.invalidExcluded += 1;
      continue;
    }

    additions.push({
      ...item,
      content_id: item.content_id.trim(),
      product_id: item.product_id?.trim() || item.content_id.trim(),
    });

    if (additions.length >= target) break;
  }

  stats.finalAddCount = additions.length;
  return { additions, stats };
}

function printDryRunReport({ stats, fanzaFetched, additions, beforeCount }) {
  console.log("=== 作品追加 dry-run 結果 ===");
  console.log(`FANZA取得件数: ${fanzaFetched}`);
  console.log(`既存重複除外件数: ${stats.duplicateExcluded}`);
  console.log(`画像なし除外件数: ${stats.noImageExcluded}`);
  console.log(`無効データ除外件数: ${stats.invalidExcluded}`);
  console.log(`最終追加予定件数: ${stats.finalAddCount}`);
  console.log(`追加後カタログ件数(予定): ${beforeCount + stats.finalAddCount}`);
  console.log("");
  console.log("追加予定作品の先頭10件:");
  for (const [index, item] of additions.slice(0, 10).entries()) {
    const actress =
      item.iteminfo?.actress?.[0]?.name ??
      item.actress?.[0]?.name ??
      "—";
    console.log(
      `${index + 1}. ${item.content_id} | ${item.title} | ${actress}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFiles();

  const { items: existingItems, envelope, raw } = loadSnapshot();
  const existingIds = new Set(
    existingItems.map((item) => normalizeContentId(item.content_id)).filter(Boolean),
  );

  console.log(
    `mode=${options.dryRun ? "dry-run" : "execute"} target=${options.target} fetch-limit=${options.fetchLimit} require-image=${options.requireImage}`,
  );
  console.log(`既存カタログ件数: ${existingItems.length}`);

  const { fetched, fanzaFetched } = await fetchCandidates({
    fetchLimit: options.fetchLimit,
  });

  const { additions, stats } = selectAdditions({
    fetched,
    existingIds,
    target: options.target,
    requireImage: options.requireImage,
  });

  if (options.dryRun) {
    printDryRunReport({
      stats,
      fanzaFetched,
      additions,
      beforeCount: existingItems.length,
    });
    return;
  }

  if (additions.length === 0) {
    console.error("追加対象がありません。");
    process.exit(1);
  }

  const preparedIds = new Set(
    additions.map((item) => normalizeContentId(item.content_id)),
  );
  const mergedItems = [
    ...additions,
    ...existingItems.filter(
      (item) => !preparedIds.has(normalizeContentId(item.content_id)),
    ),
  ];

  const output = buildSnapshotOutput(envelope, mergedItems, raw);
  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

  console.log("=== 作品追加 実行結果 ===");
  console.log(`追加件数: ${additions.length}`);
  console.log(`追加後カタログ件数: ${mergedItems.length}`);
  console.log(`保存: ${SNAPSHOT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
