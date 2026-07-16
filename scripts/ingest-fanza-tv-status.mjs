#!/usr/bin/env node
/**
 * ローカル専用: FANZA TV 収集結果を work_live_status へ投入
 *
 * Vercel / 管理画面ボタンからの Playwright 全件実行は禁止。
 * 先に scripts/fanza-tv-collect.mjs で result.json を作り、本スクリプトでDB反映。
 *
 *   node scripts/ingest-fanza-tv-status.mjs
 *   node scripts/ingest-fanza-tv-status.mjs --unknown-only
 *   node scripts/ingest-fanza-tv-status.mjs --limit=100 --resume
 */

import { createRequire } from "module";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const RESULT_PATH = resolve(root, "reports/fanza-tv-collect/result.json");
const JOB_PATH = resolve(root, "data/dmm/fanza-tv-ingest-job.json");

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@/": `${root}/`,
    "server-only": resolve(root, "scripts/shims/server-only.mjs"),
  },
});

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
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
loadEnvFile(resolve(root, ".env"));

function parseArgs(argv) {
  const args = { unknownOnly: false, resume: false, limit: 100, markOthers: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--unknown-only") args.unknownOnly = true;
    else if (a === "--resume") args.resume = true;
    else if (a === "--mark-others-not-available") args.markOthers = true;
    else if (a === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]);
  }
  return args;
}

function readJob() {
  if (!existsSync(JOB_PATH)) {
    return { cursor: 0, processed: 0, updated: 0, skipped: 0, errors: [] };
  }
  return JSON.parse(readFileSync(JOB_PATH, "utf8"));
}

function writeJob(job) {
  mkdirSync(dirname(JOB_PATH), { recursive: true });
  writeFileSync(JOB_PATH, `${JSON.stringify(job, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(RESULT_PATH)) {
    throw new Error(
      `${RESULT_PATH} がありません。先にローカルで node scripts/fanza-tv-collect.mjs を実行してください。`,
    );
  }

  const result = JSON.parse(readFileSync(RESULT_PATH, "utf8"));
  const activeCids = [
    ...new Set(
      Object.keys(result.itemsByCid || result.items || {})
        .map((c) => String(c).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (Array.isArray(result.items)) {
    for (const item of result.items) {
      const cid = String(item.cid || item.content_id || "")
        .trim()
        .toLowerCase();
      if (cid && !activeCids.includes(cid)) activeCids.push(cid);
    }
  }

  const { supabaseFetchAllWorkMasterCids } = jiti(
    "../lib/dmm/works-master/supabase-store.ts",
  );
  const { supabaseFetchLiveStatusByCids, supabaseUpsertLiveStatusRows } = jiti(
    "../lib/dmm/work-live-status/supabase-store.ts",
  );
  const { upsertWorksCmsOverrides } = jiti(
    "../lib/admin/works-cms-overrides.ts",
  );

  const allCids = await supabaseFetchAllWorkMasterCids();
  const activeSet = new Set(activeCids);
  const job = args.resume ? readJob() : { cursor: 0, processed: 0, updated: 0, skipped: 0, errors: [] };

  const targets = allCids.slice(job.cursor);
  const batch = targets.slice(0, Math.max(1, args.limit));
  const now = new Date().toISOString();
  const existing = await supabaseFetchLiveStatusByCids(batch);

  const rows = [];
  const overrides = [];
  let becameActive = 0;
  let becameUnavailable = 0;

  for (const cid of batch) {
    const prev = existing.get(cid);
    const prevStatus = (prev?.fanza_tv_status || "").toLowerCase();
    if (args.unknownOnly && prevStatus && prevStatus !== "unknown") {
      job.skipped += 1;
      job.processed += 1;
      continue;
    }

    let nextStatus = "not_available";
    if (activeSet.has(cid)) nextStatus = "active";
    else if (!args.markOthers && !activeSet.has(cid) && !prevStatus) {
      // 収集結果に無いものは unknown（誤って not_available にしない）
      nextStatus = "unknown";
    }

    if (prevStatus === nextStatus) {
      job.skipped += 1;
      job.processed += 1;
      continue;
    }
    if (nextStatus === "active" && prevStatus !== "active") becameActive += 1;
    if (nextStatus === "not_available" && prevStatus === "active") {
      becameUnavailable += 1;
    }

    rows.push({
      cid,
      price: prev?.price ?? null,
      list_price: prev?.list_price ?? null,
      discount_rate: prev?.discount_rate ?? null,
      is_sale: prev?.is_sale ?? false,
      sale_end_at: prev?.sale_end_at ?? null,
      rating: prev?.rating ?? null,
      review_count: prev?.review_count ?? null,
      popularity_rank: prev?.popularity_rank ?? null,
      new_arrival_rank: prev?.new_arrival_rank ?? null,
      is_available: prev?.is_available !== false,
      fanza_tv_status: nextStatus,
      checked_at: prev?.checked_at ?? now,
      updated_at: now,
    });
    overrides.push({
      cid,
      fanza_tv_status: nextStatus,
      fanza_tv_checked_at: now,
      fanza_tv_changed_at: now,
      fanza_tv_source: "local_playwright_collect",
      fanza_tv_error: null,
    });
    job.updated += 1;
    job.processed += 1;
  }

  if (rows.length > 0) {
    await supabaseUpsertLiveStatusRows(rows);
    upsertWorksCmsOverrides(overrides);
  }

  job.cursor = (job.cursor || 0) + batch.length;
  job.becameActive = (job.becameActive || 0) + becameActive;
  job.becameUnavailable = (job.becameUnavailable || 0) + becameUnavailable;
  job.updatedAt = now;
  job.message =
    job.cursor >= allCids.length
      ? "ingest completed"
      : `cursor=${job.cursor}/${allCids.length}`;
  writeJob(job);

  console.log(
    JSON.stringify(
      {
        ok: true,
        batchSize: batch.length,
        updated: rows.length,
        skipped: job.skipped,
        cursor: job.cursor,
        total: allCids.length,
        activeInCollect: activeCids.length,
        becameActive,
        becameUnavailable,
        note: "Playwrightはローカル専用。Vercelでは実行しないこと。",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[ingest-fanza-tv-status] failed", error);
  process.exitCode = 1;
});
