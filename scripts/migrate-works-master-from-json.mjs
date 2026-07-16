#!/usr/bin/env node
/**
 * 第5段階: 既存カタログJSONの全作品を Supabase works へ一括移行
 *
 * - CID primary key upsert / 100件バッチ
 * - チェックポイント保存・途中再開
 * - 429・接続・カラム不一致・タイムアウトは安全停止（無限リトライなし）
 * - JSON書き換え・Git・commit・push・deploy・revalidate なし
 *
 *   node scripts/migrate-works-master-from-json.mjs
 *   node scripts/migrate-works-master-from-json.mjs --resume
 *   node scripts/migrate-works-master-from-json.mjs --force-restart
 *   node scripts/migrate-works-master-from-json.mjs --dry-run
 */

import { createRequire } from "module";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@/": `${root}/`,
    "server-only": resolve(root, "scripts/shims/server-only.mjs"),
  },
});

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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

process.env.WORKS_MASTER_ENABLED = "true";
process.env.WORKS_MASTER_BACKEND = process.env.WORKS_MASTER_BACKEND || "auto";

function parseArgs(argv) {
  const args = {
    resume: false,
    forceRestart: false,
    dryRun: false,
    batchSize: 100,
    maxBatches: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--resume") args.resume = true;
    else if (arg === "--force-restart") args.forceRestart = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--batch-size" && argv[i + 1]) {
      args.batchSize = Number(argv[++i]);
    } else if (arg.startsWith("--batch-size=")) {
      args.batchSize = Number(arg.split("=")[1]);
    } else if (arg === "--max-batches" && argv[i + 1]) {
      args.maxBatches = Number(argv[++i]);
    } else if (arg.startsWith("--max-batches=")) {
      args.maxBatches = Number(arg.split("=")[1]);
    }
  }
  return args;
}

function gitPorcelain() {
  try {
    return execSync("git status --porcelain", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "(git status failed)";
  }
}

function formatMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${(sec / 60).toFixed(1)}m`;
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();
  const beforeGit = gitPorcelain();

  const {
    isWorksMasterSupabaseConfigured,
    getConfiguredWorksMasterBackend,
  } = jiti("../lib/dmm/works-master/index.ts");

  const {
    previewWorksMasterMigration,
    runWorksMasterMigrationToCompletion,
  } = jiti("../lib/admin/works-master-migration-runner.ts");

  const { supabaseCountWorkMasterRows } = jiti(
    "../lib/dmm/works-master/supabase-store.ts",
  );

  if (!isWorksMasterSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。",
    );
  }

  const backend = getConfiguredWorksMasterBackend();
  if (backend !== "supabase") {
    throw new Error(`backend が supabase ではありません: ${backend}`);
  }

  console.log("[migrate-works-master] preview…");
  const preview = await previewWorksMasterMigration();
  console.log(
    JSON.stringify(
      {
        phase: "preview",
        jsonTotalCount: preview.jsonTotalCount,
        jsonUniqueCidCount: preview.jsonUniqueCidCount,
        jsonDuplicateCidCount: preview.jsonDuplicateCidCount,
        supabaseCountBefore: preview.supabaseCountBefore,
        supabaseOverlapBefore: preview.supabaseOverlapBefore,
      },
      null,
      2,
    ),
  );

  if (args.dryRun) {
    console.log("[migrate-works-master] dry-run のためここで終了");
    return;
  }

  const { readWorksMasterMigrationJob } = jiti(
    "../lib/admin/works-master-migration-store.ts",
  );
  const { isWorksMasterMigrationResumable } = jiti(
    "../lib/admin/works-master-migration-job.ts",
  );
  const existingJob = readWorksMasterMigrationJob();
  const shouldResume =
    args.resume ||
    (!args.forceRestart && isWorksMasterMigrationResumable(existingJob));

  console.log(
    `[migrate-works-master] start batchSize=${args.batchSize} resume=${shouldResume} forceRestart=${args.forceRestart}`,
  );

  const { job } = await runWorksMasterMigrationToCompletion({
    batchSize: args.batchSize,
    forceRestart: args.forceRestart,
    resume: shouldResume,
    maxBatches: args.maxBatches ?? undefined,
  });

  const supabaseCountAfter =
    job.supabaseCountAfter ?? (await supabaseCountWorkMasterRows());
  const afterGit = gitPorcelain();
  const wallMs = Date.now() - startedAt;

  const report = {
    ok: job.status === "completed",
    status: job.status,
    stopReason: job.stopReason,
    message: job.message,
    jsonTotalCount: preview.jsonTotalCount,
    jsonUniqueCidCount: preview.jsonUniqueCidCount,
    supabaseCountBefore: preview.supabaseCountBefore,
    supabaseCountAfter,
    addedCount: job.addedCount,
    updatedCount: job.updatedCount,
    duplicateCount: job.duplicateCount,
    failedCount: job.failedCount,
    processedCount: job.processedCount,
    targetCount: job.targetCount,
    batchCount: job.batchLogs.length,
    lastProcessedCid: job.lastProcessedCid,
    totalDurationMs: job.totalDurationMs,
    wallClockMs: wallMs,
    totalDuration: formatMs(job.totalDurationMs),
    wallClock: formatMs(wallMs),
    gitDiffOccurred: beforeGit !== afterGit,
    // 移行ジョブJSONは gitignore。tracked 差分のみ意味あり
    deployOccurred: false,
    jsonRewritten: false,
    commitPush: false,
    revalidateAll: false,
  };

  console.log(JSON.stringify(report, null, 2));

  if (job.status !== "completed") {
    console.error(
      `[migrate-works-master] 完了していません: status=${job.status} reason=${job.stopReason ?? "-"}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[migrate-works-master] failed", error);
  process.exitCode = 1;
});
