#!/usr/bin/env node
/**
 * 掲載済み作品更新 API の段階的検証
 * 使い方: node scripts/test-catalog-refresh-http.mjs --count 10 --dry-run
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, ".env.local"));

function adminCookie() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) throw new Error("ADMIN_PASSWORD missing");
  const value = createHash("sha256")
    .update(`admin-session:${password}`)
    .digest("hex");
  return `adult_zukan_admin_session=${value}`;
}

function parseArgs() {
  const args = { counts: [10], dryRun: true, baseUrl: "http://localhost:3000" };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--count" && process.argv[i + 1]) {
      args.counts = [Number(process.argv[++i])];
    } else if (arg === "--counts" && process.argv[i + 1]) {
      args.counts = process.argv[++i].split(",").map((v) => Number(v.trim()));
    } else if (arg === "--commit") args.dryRun = false;
    else if (arg === "--base-url" && process.argv[i + 1]) {
      args.baseUrl = process.argv[++i];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const cookie = adminCookie();
  const results = [];

  for (const count of args.counts) {
    const startedAt = Date.now();
    const response = await fetch(`${args.baseUrl}/api/admin/import/refresh-works`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        batchSize: count,
        dryRun: args.dryRun,
        prioritizeSale: true,
        prioritizeStale: true,
        prioritizePopular: true,
      }),
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // keep raw
    }

    console.log(`\n=== refresh count=${count} dryRun=${args.dryRun} ===`);
    console.log({
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      summary: payload?.summary,
      message: payload?.message ?? payload?.error,
      bodyPreview: text.slice(0, 1500),
    });

    results.push({
      count,
      ok: response.ok && payload?.success !== false,
      status: response.status,
      summary: payload?.summary,
    });

    if (!response.ok || payload?.success === false) break;
  }

  console.log("\n=== summary ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
