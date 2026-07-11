#!/usr/bin/env node
/**
 * DMM APIからカタログスナップショットを差分更新する。
 * 用法: npm run fetch-catalog
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const ENV_FILES = [".env.local", ".env"];
const SNAPSHOT_FILE = path.join(ROOT, "data", "dmm", "catalog-snapshot.json");
const API_AFFILIATE_FALLBACK = "zukanjp-990";
const FANZA_GRAPHQL_URL = "https://api.video.dmm.co.jp/graphql";

const MIN_VALID = 300;
const FETCH_BATCH_SIZE = 100;
const MAX_OFFSET = 5001;
const DESCRIPTION_CONCURRENCY = 8;
const MAX_API_REQUESTS = 140;
const KEYWORD_PAGE_LIMIT = 2;
const KEYWORD_LIMIT_PER_GROUP = 20;

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
  const workers = Array.from({ length: DESCRIPTION_CONCURRENCY }, async () => {
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
  });

  await Promise.all(workers);

  console.log(`説明文: 既存=${preserved} 新規取得=${fetched} 未取得=${missing}`);
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

function parsePrice(value) {
  if (!value) return 0;
  const parsed = Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isOnSale(item) {
  const price = parsePrice(item.prices?.price);
  const listPrice = parsePrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
}

function isValidItem(item) {
  if (!item.content_id?.trim() || !item.title?.trim()) return false;
  if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
  const image = item.imageURL?.large || item.imageURL?.list || item.imageURL?.small;
  return isValidImageUrl(image);
}

function normalizeDateKey(item) {
  const date = item.date?.trim()?.slice(0, 10) ?? "";
  return date;
}

function duplicateKey3(item, makerName) {
  const title = item.title?.trim().toLowerCase() ?? "";
  const maker = makerName?.trim().toLowerCase() ?? "";
  const date = normalizeDateKey(item);
  return `${title}||${maker}||${date}`;
}

function getMakerName(item) {
  return item.maker?.[0]?.name ?? item.iteminfo?.maker?.[0]?.name ?? "";
}

function collectTopNames(items, selector, limit) {
  const counts = new Map();
  for (const item of items) {
    const names = selector(item);
    for (const name of names) {
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit)
    .map(([name]) => name);
}

function loadPreviousSnapshot() {
  if (!existsSync(SNAPSHOT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : parsed.works ?? [];
  } catch {
    return [];
  }
}

function countValidCatalogItems(items) {
  return items.filter((item) => {
    if (!item.content_id?.trim() || !item.title?.trim()) return false;
    if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
    if (item.content_id?.toLowerCase().startsWith("vr")) return false;
    const image = item.imageURL?.large || item.imageURL?.list || item.imageURL?.small;
    return Boolean(image && isValidImageUrl(image));
  }).length;
}

function shouldSkipFetchCatalog(previous) {
  if (process.env.FORCE_FETCH_CATALOG === "1") return false;

  const onVercel = process.env.VERCEL === "1";
  const skipFlag = process.env.SKIP_FETCH_CATALOG === "1";
  if (!onVercel && !skipFlag) return false;

  if (previous.length === 0) return false;

  const validCount = countValidCatalogItems(previous);
  if (validCount >= MIN_VALID) {
    console.log(
      `[prebuild] fetch-catalog をスキップ: 有効作品 ${validCount} 件（コミット済み snapshot を利用）`,
    );
    return true;
  }

  console.warn(
    `[prebuild] snapshot の有効作品が ${validCount} 件（最低 ${MIN_VALID} 件未満）のため取得を続行します`,
  );
  return false;
}

async function fetchPage({ apiId, affiliateId, offset, sort = "rank", keyword }) {
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
  if (keyword) {
    url.searchParams.set("keyword", keyword);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (String(data.result?.status) !== "200") {
    throw new Error(`API status ${data.result?.status}`);
  }
  return data.result.items ?? [];
}

async function main() {
  loadEnvFiles();

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID ?? API_AFFILIATE_FALLBACK;
  if (!apiId) {
    console.error("DMM_API_ID が .env.local に必要です");
    process.exit(1);
  }

  const previous = loadPreviousSnapshot();
  if (shouldSkipFetchCatalog(previous)) {
    return;
  }

  const beforeCount = previous.length;

  const byContentId = new Set();
  const byProductId = new Set();
  const byComposite = new Set();

  const finalItems = [];
  for (const item of previous) {
    const makerName = getMakerName(item);
    const key3 = duplicateKey3(item, makerName);
    finalItems.push(item);
    if (item.content_id) byContentId.add(item.content_id);
    if (item.product_id) byProductId.add(item.product_id);
    byComposite.add(key3);
  }

  let requestCount = 0;
  let apiTotal = 0;
  let duplicateExcluded = 0;
  let noImageExcluded = 0;
  let invalidExcluded = 0;
  let fetchFailed = 0;
  let saleSeeded = 0;

  const tryAddItem = (item, sourcePopularityRank = null) => {
    const makerName = getMakerName(item);
    const key3 = duplicateKey3(item, makerName);

    if (item.content_id && byContentId.has(item.content_id)) {
      duplicateExcluded += 1;
      return false;
    }
    if (item.product_id && byProductId.has(item.product_id)) {
      duplicateExcluded += 1;
      return false;
    }
    if (byComposite.has(key3)) {
      duplicateExcluded += 1;
      return false;
    }

    const image = item.imageURL?.large || item.imageURL?.list || item.imageURL?.small;
    if (!isValidImageUrl(image)) {
      noImageExcluded += 1;
      return false;
    }

    if (!isValidItem(item)) {
      invalidExcluded += 1;
      return false;
    }

    const nextItem =
      typeof sourcePopularityRank === "number" && sourcePopularityRank > 0
        ? {
            ...item,
            sourcePopularityRank,
            popularityUpdatedAt: new Date().toISOString(),
          }
        : item;

    finalItems.push(nextItem);
    if (item.content_id) byContentId.add(item.content_id);
    if (item.product_id) byProductId.add(item.product_id);
    byComposite.add(key3);
    return true;
  };

  const remainingSlots = () => Number.POSITIVE_INFINITY;

  const fetchBySort = async (sort) => {
    for (let offset = 1; offset <= MAX_OFFSET; offset += FETCH_BATCH_SIZE) {
      if (remainingSlots() <= 0 || requestCount >= MAX_API_REQUESTS) break;
      requestCount += 1;

      let pageItems = [];
      try {
        pageItems = await fetchPage({ apiId, affiliateId, offset, sort });
      } catch {
        fetchFailed += 1;
        continue;
      }

      if (pageItems.length === 0) break;
      apiTotal += pageItems.length;

      for (let index = 0; index < pageItems.length; index += 1) {
        const item = pageItems[index];
        const added = tryAddItem(item, sort === "rank" ? offset + index : null);
        if (added && isOnSale(item)) saleSeeded += 1;
        if (remainingSlots() <= 0) break;
      }

      const validNow = finalItems.length;
      console.log(`[${sort}] offset=${offset} 登録=${validNow} 残り=${remainingSlots()}`);
      if (pageItems.length < FETCH_BATCH_SIZE) break;
    }
  };

  const fetchByKeywordGroup = async (label, keywords) => {
    for (const keyword of keywords) {
      if (remainingSlots() <= 0 || requestCount >= MAX_API_REQUESTS) break;

      for (let page = 0; page < KEYWORD_PAGE_LIMIT; page += 1) {
        if (remainingSlots() <= 0 || requestCount >= MAX_API_REQUESTS) break;

        const offset = 1 + page * FETCH_BATCH_SIZE;
        requestCount += 1;

        let pageItems = [];
        try {
          pageItems = await fetchPage({
            apiId,
            affiliateId,
            offset,
            sort: "rank",
            keyword,
          });
        } catch {
          fetchFailed += 1;
          continue;
        }

        if (pageItems.length === 0) break;
        apiTotal += pageItems.length;

        for (let index = 0; index < pageItems.length; index += 1) {
          tryAddItem(pageItems[index], offset + index);
          if (remainingSlots() <= 0) break;
        }

        console.log(`[${label}] keyword=${keyword} page=${page + 1} 登録=${finalItems.length}`);
        if (pageItems.length < FETCH_BATCH_SIZE) break;
      }
    }
  };

  // 1) 人気順
  await fetchBySort("rank");
  // 2) 新着順
  await fetchBySort("date");

  const seedForFacet = finalItems.length > 0 ? finalItems : previous;

  // 3) セール作品（keywordベース + 既存seedからの追加は上のsortで取り込み済み）
  await fetchByKeywordGroup("sale", ["セール", "割引", "期間限定"]);

  // 4) ジャンル別
  const topGenres = collectTopNames(
    seedForFacet,
    (item) => (item.iteminfo?.genre ?? []).map((g) => g.name).filter(Boolean),
    KEYWORD_LIMIT_PER_GROUP,
  );
  await fetchByKeywordGroup("genre", topGenres);

  // 5) メーカー別
  const topMakers = collectTopNames(
    seedForFacet,
    (item) => [getMakerName(item)].filter(Boolean),
    KEYWORD_LIMIT_PER_GROUP,
  );
  await fetchByKeywordGroup("maker", topMakers);

  // 6) シリーズ別
  const topSeries = collectTopNames(
    seedForFacet,
    (item) =>
      [item.series?.[0]?.name ?? item.iteminfo?.series?.[0]?.name].filter(Boolean),
    KEYWORD_LIMIT_PER_GROUP,
  );
  await fetchByKeywordGroup("series", topSeries);

  const finalLimited = finalItems;
  if (finalLimited.length < MIN_VALID) {
    console.error(
      `有効作品が${MIN_VALID}件未満(${finalLimited.length}件)のためスナップショットを更新しません`,
    );
    process.exit(1);
  }

  const previousById = new Map(previous.map((item) => [item.content_id, item]));
  console.log("説明文を取得中...");
  await enrichDescriptions(finalLimited, previousById);

  mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(finalLimited, null, 2), "utf-8");

  const afterCount = finalLimited.length;
  const addedCount = Math.max(0, afterCount - beforeCount);

  console.log("=== カタログ取得結果 ===");
  console.log(`取得前の作品数: ${beforeCount}`);
  console.log(`取得後の作品数: ${afterCount}`);
  console.log(`新規追加件数: ${addedCount}`);
  console.log(`重複除外件数: ${duplicateExcluded}`);
  console.log(`画像なし除外件数: ${noImageExcluded}`);
  console.log(`取得失敗件数: ${fetchFailed}`);
  console.log(`その他除外件数: ${invalidExcluded}`);
  console.log(`API取得総数: ${apiTotal}`);
  console.log(`APIリクエスト数: ${requestCount}`);
  console.log(`セール起点追加件数(参考): ${saleSeeded}`);
  console.log(`保存: ${SNAPSHOT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
