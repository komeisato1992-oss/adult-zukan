#!/usr/bin/env node
/**
 * works に fanza_tv_* 列があるか確認する。
 * DDL は Dashboard SQL が必要。列が無ければ SQL パスを表示して exit 1。
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
  const { error } = await client
    .from("works")
    .select("cid,fanza_tv_status,fanza_tv_checked_at,fanza_tv_url")
    .limit(1);
  if (!error) {
    console.log("OK: works.fanza_tv_* columns are ready");
    return;
  }
  console.error("MISSING_SCHEMA:", error.message);
  console.error(
    "Apply SQL: supabase/migrations/20260716_004_works_fanza_tv.sql",
  );
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
