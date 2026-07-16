#!/usr/bin/env node
/**
 * 実際の work_live_status カラムを取得し、
 * supabase/migrations/20260716_005_migrate_fanza_tv_to_works.sql を再生成する。
 *
 *   node scripts/generate-fanza-tv-migrate-sql.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(
  ROOT,
  "supabase/migrations/20260716_005_migrate_fanza_tv_to_works.sql",
);

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

async function columnExists(client, table, column) {
  const { error } = await client.from(table).select(column).limit(1);
  return !error;
}

async function listLiveStatusColumns(client) {
  const { data, error } = await client
    .from("work_live_status")
    .select("*")
    .limit(1);
  if (error) throw new Error(error.message);
  if (data?.[0]) return Object.keys(data[0]);

  // 行が無い場合は候補を個別プローブ
  const candidates = [
    "cid",
    "price",
    "list_price",
    "discount_rate",
    "is_sale",
    "sale_end_at",
    "sale_start_at",
    "rating",
    "review_count",
    "popularity_rank",
    "new_arrival_rank",
    "is_available",
    "manual_hidden",
    "fanza_tv_status",
    "fanza_tv_checked_at",
    "fanza_tv_changed_at",
    "fanza_tv_source",
    "fanza_tv_error",
    "fanza_tv_url",
    "checked_at",
    "updated_at",
  ];
  const found = [];
  for (const col of candidates) {
    if (await columnExists(client, "work_live_status", col)) found.push(col);
  }
  return found;
}

function pickCheckedAtExpr(columns) {
  if (columns.includes("fanza_tv_checked_at")) return "l.fanza_tv_checked_at";
  if (columns.includes("checked_at")) return "l.checked_at";
  return "null";
}

function pickUrlExpr(columns) {
  // URL として使える列があれば採用。無ければ NULL
  const urlCandidates = ["fanza_tv_url", "fanza_tv_source"];
  for (const col of urlCandidates) {
    if (columns.includes(col)) return `nullif(l.${col}, '')`;
  }
  return "null";
}

function buildSql(columns) {
  if (!columns.includes("cid") || !columns.includes("fanza_tv_status")) {
    throw new Error(
      `work_live_status に必須列がありません: cid/fanza_tv_status (got: ${columns.join(", ")})`,
    );
  }

  const checkedAtExpr = pickCheckedAtExpr(columns);
  const urlExpr = pickUrlExpr(columns);

  return `-- Phase 7: work_live_status → works へ見放題判定を移行
-- 生成元: scripts/generate-fanza-tv-migrate-sql.mjs
-- 検出した work_live_status 列: ${columns.join(", ")}
-- checked_at 式: ${checkedAtExpr}
-- url 式: ${urlExpr}

update public.works w
set
  fanza_tv_status = case
    when lower(coalesce(l.fanza_tv_status, '')) in ('available', 'active')
      then 'available'::public.fanza_tv_status_enum
    when lower(coalesce(l.fanza_tv_status, '')) in ('unavailable', 'not_available')
      then 'unavailable'::public.fanza_tv_status_enum
    else 'unknown'::public.fanza_tv_status_enum
  end,
  fanza_tv_checked_at = ${checkedAtExpr},
  fanza_tv_url = ${urlExpr},
  updated_at = now()
from public.work_live_status l
where w.cid = l.cid
  and l.fanza_tv_status is not null
  and lower(l.fanza_tv_status) in (
    'available',
    'active',
    'unavailable',
    'not_available',
    'unknown'
  );
`;
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

  const columns = await listLiveStatusColumns(client);
  const sql = buildSql(columns);

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, sql, "utf8");

  console.log(
    JSON.stringify(
      {
        out: path.relative(ROOT, OUT_PATH),
        columns,
        checkedAtExpr: pickCheckedAtExpr(columns),
        urlExpr: pickUrlExpr(columns),
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
