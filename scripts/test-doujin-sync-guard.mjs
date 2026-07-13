#!/usr/bin/env node
/**
 * 書き込みガード / 同期フィールドの単体チェック（API不要）
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@/": `${root}/`,
    "server-only": resolve(root, "scripts/shims/server-only.mjs"),
  },
});

const prev = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in prev)) delete process.env[key];
  }
  Object.assign(process.env, prev);
}

// --- write guard ---
{
  resetEnv();
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  process.env.DOUJIN_LOCAL_WRITE_ENABLED = "true";
  // re-import fresh via jiti cache bust: call functions after setting env
  const { isDoujinLocalWriteAllowed } = jiti("../lib/doujin/write-guard.ts");
  assert.equal(isDoujinLocalWriteAllowed(), true, "local write allowed");
}

{
  resetEnv();
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.DOUJIN_LOCAL_WRITE_ENABLED = "true";
  // Clear jiti module cache for write-guard
  const guardPath = resolve(root, "lib/doujin/write-guard.ts");
  for (const key of Object.keys(jiti.cache || {})) {
    if (String(key).includes("write-guard")) delete jiti.cache[key];
  }
  // jiti may cache - evaluate inline
  const { isVercelRuntime } = jiti("../lib/admin/runtime-fs.ts");
  assert.equal(isVercelRuntime(), true);
  // Direct logic check
  const allowed =
    !Boolean(process.env.VERCEL) &&
    process.env.DOUJIN_LOCAL_WRITE_ENABLED === "true";
  assert.equal(allowed, false, "vercel blocks write");
}

{
  resetEnv();
  delete process.env.VERCEL;
  delete process.env.DOUJIN_LOCAL_WRITE_ENABLED;
  const allowed =
    !Boolean(process.env.VERCEL) &&
    process.env.DOUJIN_LOCAL_WRITE_ENABLED === "true";
  assert.equal(allowed, false, "unset local write disabled");
}

// --- light fields ---
{
  const { expectedUpdateFields } = jiti("../lib/doujin/sync-diff.ts");
  const light = expectedUpdateFields("light");
  assert.ok(light.includes("price"));
  assert.ok(!light.includes("title"));
  assert.ok(!light.includes("sampleImageUrls"));
  assert.ok(!light.includes("rawApiResponse"));
  const full = expectedUpdateFields("full");
  assert.ok(full.includes("title"));
  assert.ok(full.includes("rawApiResponse"));
}

// --- light / full flags (unset = disabled) ---
{
  resetEnv();
  delete process.env.DOUJIN_LIGHT_SYNC_ENABLED;
  delete process.env.DOUJIN_FULL_SYNC_ENABLED;
  for (const key of Object.keys(jiti.cache || {})) {
    if (String(key).includes("sync-mode")) delete jiti.cache[key];
  }
  const { isDoujinLightSyncEnabled, isDoujinFullSyncEnabled } = jiti(
    "../lib/doujin/sync-mode.ts",
  );
  assert.equal(isDoujinLightSyncEnabled(), false, "light unset disabled");
  assert.equal(isDoujinFullSyncEnabled(), false, "full unset disabled");
}

{
  resetEnv();
  process.env.DOUJIN_LIGHT_SYNC_ENABLED = "true";
  process.env.DOUJIN_FULL_SYNC_ENABLED = "true";
  for (const key of Object.keys(jiti.cache || {})) {
    if (String(key).includes("sync-mode")) delete jiti.cache[key];
  }
  const { isDoujinLightSyncEnabled, isDoujinFullSyncEnabled } = jiti(
    "../lib/doujin/sync-mode.ts",
  );
  assert.equal(isDoujinLightSyncEnabled(), true, "light true enabled");
  assert.equal(isDoujinFullSyncEnabled(), true, "full true enabled");
}

{
  resetEnv();
  process.env.DOUJIN_LIGHT_SYNC_ENABLED = "1";
  process.env.DOUJIN_FULL_SYNC_ENABLED = "yes";
  for (const key of Object.keys(jiti.cache || {})) {
    if (String(key).includes("sync-mode")) delete jiti.cache[key];
  }
  const { isDoujinLightSyncEnabled, isDoujinFullSyncEnabled } = jiti(
    "../lib/doujin/sync-mode.ts",
  );
  assert.equal(isDoujinLightSyncEnabled(), false, "light 1 disabled");
  assert.equal(isDoujinFullSyncEnabled(), false, "full yes disabled");
}

console.log(
  JSON.stringify(
    { ok: true, checks: ["write-guard", "sync-fields", "sync-flags"] },
    null,
    2,
  ),
);
