#!/usr/bin/env node
/**
 * アダルト同期ガード / フィールド単体チェック
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

{
  resetEnv();
  delete process.env.VERCEL;
  process.env.ADULT_LOCAL_WRITE_ENABLED = "true";
  const { isAdultLocalWriteAllowed } = jiti("../lib/dmm/write-guard.ts");
  assert.equal(isAdultLocalWriteAllowed(), true);
}

{
  resetEnv();
  process.env.VERCEL = "1";
  process.env.ADULT_LOCAL_WRITE_ENABLED = "true";
  const allowed =
    !Boolean(process.env.VERCEL) &&
    process.env.ADULT_LOCAL_WRITE_ENABLED === "true";
  assert.equal(allowed, false);
}

{
  resetEnv();
  delete process.env.ADULT_LIGHT_SYNC_ENABLED;
  delete process.env.ADULT_FULL_SYNC_ENABLED;
  for (const key of Object.keys(jiti.cache || {})) {
    if (String(key).includes("sync-mode")) delete jiti.cache[key];
  }
  const { isAdultLightSyncEnabled, isAdultFullSyncEnabled } = jiti(
    "../lib/dmm/sync-mode.ts",
  );
  assert.equal(isAdultLightSyncEnabled(), false);
  assert.equal(isAdultFullSyncEnabled(), false);
}

{
  const { expectedAdultUpdateFields } = jiti("../lib/dmm/sync-diff.ts");
  const light = expectedAdultUpdateFields("light");
  assert.ok(light.includes("prices"));
  assert.ok(!light.includes("title"));
  assert.ok(!light.includes("sampleImageURL"));
}

console.log(
  JSON.stringify({ ok: true, checks: ["adult-write-guard", "adult-sync-flags"] }, null, 2),
);
