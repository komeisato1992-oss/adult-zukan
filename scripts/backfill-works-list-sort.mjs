#!/usr/bin/env node
/**
 * カタログ → work_live_status へ価格・順位・評価を埋める。
 * 併せて price_amount / duration_minutes 列があれば更新する。
 *
 * Usage: node scripts/backfill-works-list-sort.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHUNK = 200;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
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

function parseComparablePrice(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/,/g, "").replace(/[^\d]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDurationMinutes(value) {
  return parseComparablePrice(value);
}

function loadCatalogItems() {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, "data/dmm/catalog/manifest.json"), "utf8"),
  );
  const shards = manifest.shards || manifest.files || [];
  const items = [];
  for (const entry of shards) {
    const file =
      typeof entry === "string"
        ? entry
        : entry.file || entry.name || entry.path;
    if (!file) continue;
    const full = path.join(ROOT, "data/dmm/catalog", path.basename(file));
    if (!existsSync(full)) continue;
    const data = JSON.parse(readFileSync(full, "utf8"));
    const batch = data.items || data;
    if (Array.isArray(batch)) items.push(...batch);
  }
  return items;
}

function toLiveRow(item, now, hasPriceAmount) {
  const cid = String(item.content_id || "").trim().toLowerCase();
  if (!cid) return null;
  const price = item.prices?.price ?? item.salePrice ?? null;
  const listPrice = item.prices?.list_price ?? item.regularPrice ?? null;
  const priceText = price == null ? null : String(price).trim() || null;
  const listText =
    listPrice == null ? null : String(listPrice).trim() || null;
  const priceAmount = parseComparablePrice(priceText ?? price);
  const rank =
    typeof item.sourcePopularityRank === "number" &&
    item.sourcePopularityRank > 0
      ? Math.round(item.sourcePopularityRank)
      : null;
  const ratingRaw = item.review?.average;
  const rating =
    ratingRaw == null || ratingRaw === ""
      ? null
      : Number.parseFloat(String(ratingRaw));
  const reviewCount =
    typeof item.review?.count === "number" && item.review.count > 0
      ? Math.round(item.review.count)
      : null;

  const regular = parseComparablePrice(listText);
  const current = priceAmount;
  let discountRate = null;
  let isSale = false;
  if (regular && current && current < regular) {
    discountRate = Math.round(((regular - current) / regular) * 100);
    if (discountRate > 0 && discountRate < 100) isSale = true;
    else discountRate = null;
  }
  if (typeof item.discountRate === "number" && item.discountRate > 0) {
    discountRate = Math.round(item.discountRate);
    isSale = true;
  }

  const row = {
    cid,
    price: priceText,
    list_price: listText,
    discount_rate: discountRate,
    is_sale: isSale,
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    review_count: reviewCount,
    popularity_rank: rank,
    is_available: item.isActive !== false,
    checked_at: now,
    updated_at: now,
  };
  if (hasPriceAmount) {
    row.price_amount = priceAmount;
  } else {
    // price_amount 未適用時: 整数価格を new_arrival_rank に格納して数値ソートする
    row.new_arrival_rank = priceAmount;
  }
  return row;
}

async function main() {
  loadEnvLocal();
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL / SERVICE_ROLE_KEY が未設定");
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const priceCol = await client
    .from("work_live_status")
    .select("price_amount")
    .limit(1);
  const hasPriceAmount = !priceCol.error;
  if (!hasPriceAmount) {
    console.warn(
      "price_amount 列がありません。整数価格は new_arrival_rank に格納します。",
    );
    console.warn(
      "本番では supabase/migrations/20260717_009_works_list_sort.sql の適用を推奨します。",
    );
  }

  const durationCol = await client
    .from("works")
    .select("duration_minutes")
    .limit(1);
  const hasDurationMinutes = !durationCol.error;

  const items = loadCatalogItems();
  console.log(`catalog items: ${items.length}`);
  const now = new Date().toISOString();
  const liveRows = [];
  const durationUpdates = [];

  for (const item of items) {
    const row = toLiveRow(item, now, hasPriceAmount);
    if (row) liveRows.push(row);
    if (hasDurationMinutes) {
      const cid = String(item.content_id || "").trim().toLowerCase();
      const minutes = parseDurationMinutes(item.volume);
      if (cid && minutes) {
        durationUpdates.push({ cid, duration_minutes: minutes });
      }
    }
  }

  let upserted = 0;
  for (let i = 0; i < liveRows.length; i += CHUNK) {
    const slice = liveRows.slice(i, i + CHUNK);
    const { error, count } = await client
      .from("work_live_status")
      .upsert(slice, { onConflict: "cid", count: "exact" });
    if (error) {
      console.error("live upsert failed", error.message);
      process.exit(1);
    }
    upserted += count ?? slice.length;
    if ((i / CHUNK) % 10 === 0) {
      console.log(`live upsert progress ${Math.min(i + CHUNK, liveRows.length)}/${liveRows.length}`);
    }
  }
  console.log(`live upserted: ${upserted}`);

  if (hasDurationMinutes && durationUpdates.length > 0) {
    let updated = 0;
    for (let i = 0; i < durationUpdates.length; i += CHUNK) {
      const slice = durationUpdates.slice(i, i + CHUNK);
      for (const row of slice) {
        const { error } = await client
          .from("works")
          .update({ duration_minutes: row.duration_minutes })
          .eq("cid", row.cid);
        if (!error) updated += 1;
      }
      if ((i / CHUNK) % 10 === 0) {
        console.log(
          `duration progress ${Math.min(i + CHUNK, durationUpdates.length)}/${durationUpdates.length}`,
        );
      }
    }
    console.log(`duration_minutes updated: ${updated}`);
  }

  const { count: withPrice } = await client
    .from("work_live_status")
    .select("cid", { count: "exact", head: true })
    .not("price", "is", null);
  const { count: withRank } = await client
    .from("work_live_status")
    .select("cid", { count: "exact", head: true })
    .not("popularity_rank", "is", null);
  console.log({ withPrice, withRank, hasPriceAmount, hasDurationMinutes });
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
