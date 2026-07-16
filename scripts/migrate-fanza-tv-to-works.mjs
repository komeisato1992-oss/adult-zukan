#!/usr/bin/env node
/**
 * work_live_status の FANZA TV 判定結果を works へ移行する。
 * 列名は実行時に実テーブルから検出する（決め打ちしない）。
 *
 * 事前: 20260716_004_works_fanza_tv.sql を適用済み
 *
 *   node scripts/migrate-fanza-tv-to-works.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = 500;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    if (trimmed.startsWith("{")) continue;
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

function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (v === "available" || v === "active") return "available";
  if (v === "unavailable" || v === "not_available") return "unavailable";
  if (v === "unknown" || v === "pending" || v === "unchecked") return "unknown";
  return null;
}

async function columnExists(client, table, column) {
  const { error } = await client.from(table).select(column).limit(1);
  return !error;
}

async function detectLiveColumns(client) {
  const { data, error } = await client
    .from("work_live_status")
    .select("*")
    .limit(1);
  if (error) throw new Error(error.message);
  const columns = data?.[0] ? Object.keys(data[0]) : [];
  if (columns.length === 0) {
    // 空テーブルでも必須列はプローブ
    for (const col of ["cid", "fanza_tv_status", "checked_at", "updated_at"]) {
      if (await columnExists(client, "work_live_status", col)) columns.push(col);
    }
  }
  return new Set(columns);
}

function pickCheckedAt(row, columns) {
  if (columns.has("fanza_tv_checked_at") && row.fanza_tv_checked_at) {
    return row.fanza_tv_checked_at;
  }
  if (columns.has("checked_at") && row.checked_at) return row.checked_at;
  return null;
}

function pickUrl(row, columns) {
  if (columns.has("fanza_tv_url") && row.fanza_tv_url) {
    return String(row.fanza_tv_url);
  }
  if (columns.has("fanza_tv_source") && row.fanza_tv_source) {
    const raw = String(row.fanza_tv_source);
    // source が URL っぽいときだけ採用
    if (/^https?:\/\//i.test(raw)) return raw;
  }
  return null;
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL / SERVICE_ROLE_KEY が未設定");
    process.exit(1);
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const col of [
    "fanza_tv_status",
    "fanza_tv_checked_at",
    "fanza_tv_url",
  ]) {
    if (!(await columnExists(client, "works", col))) {
      console.error("works.fanza_tv_* 列がありません。先に適用してください:");
      console.error("  supabase/migrations/20260716_004_works_fanza_tv.sql");
      process.exit(2);
    }
  }

  const columns = await detectLiveColumns(client);
  if (!columns.has("cid") || !columns.has("fanza_tv_status")) {
    console.error("work_live_status に cid / fanza_tv_status がありません");
    process.exit(2);
  }

  const selectCols = ["cid", "fanza_tv_status"];
  if (columns.has("fanza_tv_checked_at")) selectCols.push("fanza_tv_checked_at");
  if (columns.has("checked_at")) selectCols.push("checked_at");
  if (columns.has("fanza_tv_url")) selectCols.push("fanza_tv_url");
  if (columns.has("fanza_tv_source")) selectCols.push("fanza_tv_source");

  let from = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await client
      .from("work_live_status")
      .select(selectCols.join(","))
      .not("fanza_tv_status", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const cid = String(row.cid || "").trim();
      const status = normalizeStatus(row.fanza_tv_status);
      if (!cid || !status) {
        skipped += 1;
        continue;
      }
      const checkedAt = pickCheckedAt(row, columns);
      const fanzaUrl = pickUrl(row, columns);
      const { error: upErr } = await client
        .from("works")
        .update({
          fanza_tv_status: status,
          fanza_tv_checked_at: checkedAt,
          fanza_tv_url: fanzaUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("cid", cid);
      if (upErr) {
        console.error("update failed", cid, upErr.message);
        skipped += 1;
        continue;
      }
      updated += 1;
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  console.log(
    JSON.stringify(
      {
        updated,
        skipped,
        selectCols,
        checkedAtSource: columns.has("fanza_tv_checked_at")
          ? "fanza_tv_checked_at"
          : columns.has("checked_at")
            ? "checked_at"
            : "null",
        urlSource: columns.has("fanza_tv_url")
          ? "fanza_tv_url"
          : columns.has("fanza_tv_source")
            ? "fanza_tv_source(if http)"
            : "null",
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
