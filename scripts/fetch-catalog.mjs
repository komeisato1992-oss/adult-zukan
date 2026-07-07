#!/usr/bin/env node
/**
 * DMM APIからカタログスナップショットを再生成する。
 * 用法: npm run fetch-catalog
 *
 * 必要: .env.local に DMM_API_ID
 * アフィリエイトID未設定時は API 用 zukanjp-990 を使用
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const ENV_FILES = [".env.local", ".env"];
const SNAPSHOT_FILE = path.join(ROOT, "data", "dmm", "catalog-snapshot.json");
const API_AFFILIATE_FALLBACK = "zukanjp-990";
const FANZA_GRAPHQL_URL = "https://api.video.dmm.co.jp/graphql";
const TARGET_VALID = 1000;
const MIN_VALID = 300;
const FETCH_BATCH_SIZE = 100;
const MAX_OFFSET = 5001;
const DESCRIPTION_CONCURRENCY = 8;

const HTML_ENTITY_MAP = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function stripHtmlTags(text) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP[entity] ?? entity)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickDescription(value) {
  if (typeof value !== "string") return undefined;
  const normalized = stripHtmlTags(value);
  return normalized || undefined;
}

function extractDescriptionFromItem(item) {
  const sampleComment = item.sampleImageURL?.sampleImageComment;
  return (
    pickDescription(item.description) ??
    pickDescription(item.comment) ??
    pickDescription(sampleComment) ??
    pickDescription(item.iteminfo?.comment) ??
    pickDescription(item.iteminfo?.description) ??
    undefined
  );
}

async function fetchFanzaPpvDescription(contentId) {
  const query =
    "query PpvDescription($id: ID!) { ppvProduct(id: $id) { content { description } } }";

  try {
    const response = await fetch(FANZA_GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: contentId },
      }),
    });

    if (!response.ok) return undefined;

    const data = await response.json();
    const description = data.data?.ppvProduct?.content?.description;
    return pickDescription(description);
  } catch {
    return undefined;
  }
}

async function enrichDescriptions(items, previousById) {
  let fetched = 0;
  let preserved = 0;
  let missing = 0;

  const queue = [...items];
  const workers = Array.from(
    { length: DESCRIPTION_CONCURRENCY },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const existing =
          extractDescriptionFromItem(item) ??
          pickDescription(previousById.get(item.content_id)?.description);

        if (existing) {
          item.description = existing;
          preserved += 1;
          continue;
        }

        const description = await fetchFanzaPpvDescription(item.content_id);
        if (description) {
          item.description = description;
          fetched += 1;
        } else {
          delete item.description;
          missing += 1;
        }
      }
    },
  );

  await Promise.all(workers);

  console.log(
    `説明文: 既存=${preserved} 新規取得=${fetched} 未取得=${missing}`,
  );

  return items;
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
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  if (
    lower.includes("now_printing") ||
    lower.includes("nowprinting") ||
    lower.includes("noimage")
  ) {
    return false;
  }
  return /\.(jpe?g|webp|png|gif)(\?|$)/i.test(url);
}

function isValidItem(item) {
  if (!item.content_id?.trim() || !item.title?.trim()) return false;
  if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
  const image =
    item.imageURL?.large || item.imageURL?.list || item.imageURL?.small;
  return isValidImageUrl(image);
}

async function fetchPage(apiId, affiliateId, offset) {
  const url = new URL("https://api.dmm.com/affiliate/v3/ItemList");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", "videoa");
  url.searchParams.set("output", "json");
  url.searchParams.set("hits", String(FETCH_BATCH_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", "rank");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (String(data.result.status) !== "200") {
    throw new Error(`API status ${data.result.status}`);
  }
  return data.result.items ?? [];
}

async function main() {
  loadEnvFiles();

  const apiId = process.env.DMM_API_ID;
  const affiliateId =
    process.env.DMM_AFFILIATE_ID ?? API_AFFILIATE_FALLBACK;

  if (!apiId) {
    console.error("DMM_API_ID が .env.local に必要です");
    process.exit(1);
  }

  const raw = [];
  const seen = new Set();
  let apiTotal = 0;

  for (let offset = 1; offset <= MAX_OFFSET; offset += FETCH_BATCH_SIZE) {
    const pageItems = await fetchPage(apiId, affiliateId, offset);
    if (pageItems.length === 0) break;

    apiTotal += pageItems.length;

    for (const item of pageItems) {
      if (!item.content_id || seen.has(item.content_id)) continue;
      seen.add(item.content_id);
      raw.push(item);
    }

    const validCount = raw.filter(isValidItem).length;
    console.log(`offset=${offset} 累計=${raw.length} 有効=${validCount}`);

    if (validCount >= TARGET_VALID) break;
    if (pageItems.length < FETCH_BATCH_SIZE) break;
  }

  const valid = [];
  for (const item of raw) {
    if (!isValidItem(item)) continue;
    valid.push(item);
    if (valid.length >= TARGET_VALID) break;
  }

  console.log("=== カタログ取得結果 ===");
  console.log(`API取得総数: ${apiTotal}`);
  console.log(`除外数: ${raw.length - valid.length}`);
  console.log(`有効作品数: ${valid.length}`);
  console.log(`/works表示対象件数: ${valid.length}`);

  if (valid.length < MIN_VALID) {
    console.error(
      `有効作品が${MIN_VALID}件未満(${valid.length}件)のためスナップショットを更新しません`,
    );
    process.exit(1);
  }

  let previousById = new Map();
  if (existsSync(SNAPSHOT_FILE)) {
    try {
      const previous = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8"));
      if (Array.isArray(previous)) {
        previousById = new Map(
          previous.map((item) => [item.content_id, item]),
        );
      }
    } catch {
      previousById = new Map();
    }
  }

  console.log("説明文を取得中...");
  await enrichDescriptions(valid, previousById);

  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(valid, null, 2), "utf-8");
  console.log(`保存: ${SNAPSHOT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
