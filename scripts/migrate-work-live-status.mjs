#!/usr/bin/env node
/**
 * 既存カタログから変動情報を work_live_status へ初期投入（第1段階: 既定100件）
 *
 * Usage:
 *   node scripts/migrate-work-live-status.mjs
 *   node scripts/migrate-work-live-status.mjs --limit=100
 */
import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

function parseLimit() {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (arg) return Math.max(1, Number(arg.split("=")[1]) || 100);
  const env = Number(process.env.ADULT_LIGHT_SYNC_TARGET_LIMIT ?? 100);
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : 100;
}

function readCatalogItems() {
  const manifestPath = path.join(root, "data/dmm/catalog/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const items = [];
  for (const shard of manifest.shards ?? []) {
    const shardPath = path.join(root, "data/dmm/catalog", shard.file);
    if (!existsSync(shardPath)) continue;
    const raw = JSON.parse(readFileSync(shardPath, "utf8"));
    const arr = Array.isArray(raw) ? raw : raw.items ?? [];
    items.push(...arr);
  }
  return items;
}

function parseSale(item) {
  const price = item?.prices?.price ?? null;
  const list = item?.prices?.list_price ?? null;
  const discount =
    item?.discountRate ??
    (item?.saleStatus === "on_sale" ? item?.discountRate : null) ??
    null;
  const isSale =
    item?.saleStatus === "on_sale" ||
    (typeof discount === "number" && discount > 0);
  return {
    price: price == null ? null : String(price),
    list_price: list == null ? null : String(list),
    discount_rate:
      discount == null || discount === "" ? null : Number(discount),
    is_sale: Boolean(isSale),
    sale_end_at: item?.saleEndAt ?? null,
  };
}

function toRow(item, now) {
  const cid = String(item.content_id ?? "").trim().toLowerCase();
  if (!cid) return null;
  const sale = parseSale(item);
  const rating =
    item?.review?.average == null || item.review.average === ""
      ? null
      : Number(item.review.average);
  const reviewCount =
    item?.review?.count == null || item.review.count === ""
      ? null
      : Number(item.review.count);
  const isAvailable =
    item?.isActive !== false &&
    item?.availabilityStatus !== "unavailable" &&
    item?.availability !== "unavailable";

  return {
    cid,
    price: sale.price,
    list_price: sale.list_price,
    discount_rate: Number.isFinite(sale.discount_rate)
      ? sale.discount_rate
      : null,
    is_sale: sale.is_sale,
    sale_end_at: sale.sale_end_at,
    rating: Number.isFinite(rating) ? rating : null,
    review_count: Number.isFinite(reviewCount) ? reviewCount : null,
    popularity_rank:
      item?.sourcePopularityRank == null
        ? null
        : Number(item.sourcePopularityRank),
    new_arrival_rank: null,
    is_available: isAvailable,
    fanza_tv_status: null,
    checked_at: now,
    updated_at: now,
  };
}

async function upsertSupabase(rows) {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;

  const { createClient } = require("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const chunk = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await client.from("work_live_status").upsert(slice, {
      onConflict: "cid",
    });
    if (error) throw new Error(error.message);
    upserted += slice.length;
  }
  return upserted;
}

function upsertLocal(rows) {
  const filePath = path.join(root, "data/dmm/work-live-status.json");
  mkdirSync(path.dirname(filePath), { recursive: true });
  let file = { version: 1, updatedAt: null, entries: {} };
  if (existsSync(filePath)) {
    try {
      file = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      // reset
    }
  }
  if (!file.entries || typeof file.entries !== "object") file.entries = {};
  const now = new Date().toISOString();
  for (const row of rows) {
    file.entries[row.cid] = row;
  }
  file.updatedAt = now;
  file.version = 1;
  writeFileSync(filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  return rows.length;
}

async function main() {
  const limit = parseLimit();
  const now = new Date().toISOString();
  const items = readCatalogItems().slice(0, limit);
  const rows = items.map((item) => toRow(item, now)).filter(Boolean);

  console.log(`[migrate-work-live-status] catalog items selected: ${rows.length}`);

  let backend = "local";
  let upserted = 0;
  try {
    const supabaseCount = await upsertSupabase(rows);
    if (supabaseCount != null) {
      backend = "supabase";
      upserted = supabaseCount;
    } else {
      upserted = upsertLocal(rows);
    }
  } catch (error) {
    console.warn(
      "[migrate-work-live-status] supabase failed; using local file",
      error instanceof Error ? error.message : error,
    );
    upserted = upsertLocal(rows);
    backend = "local";
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        backend,
        upserted,
        limit,
        sampleCids: rows.slice(0, 5).map((r) => r.cid),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
