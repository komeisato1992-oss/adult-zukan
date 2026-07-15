#!/usr/bin/env node
/**
 * アダルト図鑑専用 Supabase 接続確認（読み取り専用）
 *
 * 実行:
 *   node scripts/verify-supabase-adult-zukan.mjs
 *
 * 確認項目:
 *   - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY が読み込める
 *   - works / work_live_status へ SELECT できる
 *   - 秘密鍵の値はログに出さない
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const RUN_COMMAND = "node scripts/verify-supabase-adult-zukan.mjs";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const key = s.slice(0, i).trim();
    const value = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, ".env"));

function maskPresent(value) {
  if (!value) return { loaded: false, length: 0 };
  return { loaded: true, length: value.length };
}

async function probeTable(client, table) {
  const started = Date.now();
  const { data, error } = await client.from(table).select("cid").limit(1);
  return {
    table,
    ok: !error,
    rowSampleCount: Array.isArray(data) ? data.length : 0,
    ms: Date.now() - started,
    error: error
      ? { code: error.code ?? null, message: error.message }
      : null,
  };
}

async function main() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";

  const urlInfo = maskPresent(url);
  const anonInfo = maskPresent(anonKey);
  const serviceInfo = maskPresent(serviceKey);

  console.log("=== Supabase 接続確認（読み取り専用） ===");
  console.log(
    `SUPABASE_URL: ${urlInfo.loaded ? "OK" : "NG"}` +
      (urlInfo.loaded
        ? ` (host=${url.replace(/^https?:\/\//, "").split("/")[0]})`
        : ""),
  );
  console.log(
    `SUPABASE_ANON_KEY: ${anonInfo.loaded ? "OK" : "NG"}` +
      (anonInfo.loaded ? ` (len=${anonInfo.length})` : ""),
  );
  console.log(
    `SUPABASE_SERVICE_ROLE_KEY: ${serviceInfo.loaded ? "OK" : "NG"}` +
      (serviceInfo.loaded ? ` (len=${serviceInfo.length})` : ""),
  );

  const errors = [];
  if (!urlInfo.loaded) errors.push("SUPABASE_URL が未設定です");
  if (!anonInfo.loaded) errors.push("SUPABASE_ANON_KEY が未設定です");
  if (!serviceInfo.loaded) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }

  let worksProbe = null;
  let liveProbe = null;

  if (urlInfo.loaded && serviceInfo.loaded) {
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    worksProbe = await probeTable(client, "works");
    liveProbe = await probeTable(client, "work_live_status");

    console.log(
      `works: ${worksProbe.ok ? "OK" : "NG"}` +
        (worksProbe.ok
          ? ` (select ${worksProbe.ms}ms)`
          : ` (${worksProbe.error?.code}: ${worksProbe.error?.message})`),
    );
    console.log(
      `work_live_status: ${liveProbe.ok ? "OK" : "NG"}` +
        (liveProbe.ok
          ? ` (select ${liveProbe.ms}ms)`
          : ` (${liveProbe.error?.code}: ${liveProbe.error?.message})`),
    );

    if (!worksProbe.ok) {
      errors.push(`works 接続失敗: ${worksProbe.error?.message}`);
    }
    if (!liveProbe.ok) {
      errors.push(`work_live_status 接続失敗: ${liveProbe.error?.message}`);
    }
  } else {
    console.log("works: SKIP（URL または SERVICE_ROLE_KEY 不足）");
    console.log("work_live_status: SKIP（URL または SERVICE_ROLE_KEY 不足）");
  }

  const ok = errors.length === 0;
  console.log(`結果: ${ok ? "成功" : "失敗"}`);
  if (!ok) {
    for (const message of errors) console.log(`- ${message}`);
    process.exitCode = 1;
  }

  console.log("");
  console.log(`実行コマンド: ${RUN_COMMAND}`);
}

main().catch((error) => {
  console.error("[verify-supabase-adult-zukan] failed", {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  });
  console.log("");
  console.log(`実行コマンド: ${RUN_COMMAND}`);
  process.exitCode = 1;
});
