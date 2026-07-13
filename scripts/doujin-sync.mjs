#!/usr/bin/env node
/**
 * 同人 FANZA 同期 CLI（ローカル専用）
 *
 *   DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:light -- --dry-run --limit=100
 *   DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:full -- --dry-run --limit=50
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

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
loadEnvFile(resolve(root, ".env"));

const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@/": `${root}/`,
    "server-only": resolve(root, "scripts/shims/server-only.mjs"),
  },
});

function parseArgs(argv) {
  const args = {
    mode: argv[2] || "help",
    dryRun: false,
    resume: false,
    batchSize: undefined,
    offset: undefined,
    limit: undefined,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--resume") args.resume = true;
    else if (arg.startsWith("--batch-size="))
      args.batchSize = Number(arg.slice(13));
    else if (arg === "--batch-size" && argv[i + 1])
      args.batchSize = Number(argv[++i]);
    else if (arg.startsWith("--offset=")) args.offset = Number(arg.slice(9));
    else if (arg === "--offset" && argv[i + 1]) args.offset = Number(argv[++i]);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice(8));
    else if (arg === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.mode === "help" || args.mode === "--help") {
    console.log(`Usage:
  DOUJIN_LOCAL_WRITE_ENABLED=true node scripts/doujin-sync.mjs light [--dry-run] [--limit=500] [--batch-size=500] [--offset=1] [--resume]
  DOUJIN_LOCAL_WRITE_ENABLED=true node scripts/doujin-sync.mjs full [--dry-run] [--limit=100] [--batch-size=100] [--offset=1] [--resume]
`);
    process.exit(0);
  }

  if (args.mode !== "light" && args.mode !== "full") {
    console.error(`Unknown mode: ${args.mode}`);
    process.exit(1);
  }

  if (args.mode === "full") {
    process.env.DOUJIN_FULL_SYNC_ENABLED = "true";
  }

  const {
    startDoujinSyncJob,
    runDoujinSyncUntilIdle,
  } = jiti("../lib/doujin/sync-service.ts");
  const { expectedUpdateFields } = jiti("../lib/doujin/sync-diff.ts");
  const { isDoujinLocalWriteAllowed } = jiti("../lib/doujin/write-guard.ts");
  const { getPerfSnapshot } = jiti("../lib/perf/measure.ts");
  const {
    isDoujinLightSyncEnabled,
    isDoujinFullSyncEnabled,
  } = jiti("../lib/doujin/sync-mode.ts");

  if (!isDoujinLocalWriteAllowed()) {
    console.error(
      "書き込み禁止: Vercel上、または DOUJIN_LOCAL_WRITE_ENABLED=true が未設定です。",
    );
    process.exit(1);
  }

  if (args.mode === "light" && !isDoujinLightSyncEnabled()) {
    console.error("軽量同期は DOUJIN_LIGHT_SYNC_ENABLED=true が必要です。");
    process.exit(1);
  }
  if (args.mode === "full" && !isDoujinFullSyncEnabled()) {
    console.error("完全同期は DOUJIN_FULL_SYNC_ENABLED=true が必要です。");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.mode,
        dryRun: args.dryRun,
        expectedFields: expectedUpdateFields(args.mode),
      },
      null,
      2,
    ),
  );

  const job = startDoujinSyncJob({
    mode: args.mode,
    dryRun: args.dryRun,
    resume: args.resume,
    batchSize: args.batchSize,
    startOffset: args.offset,
    limit: args.limit,
    site: "FANZA",
    service: "doujin",
    floor: "digital_doujin",
  });

  const finished = await runDoujinSyncUntilIdle(job.id);
  console.log(
    JSON.stringify(
      {
        id: finished.id,
        mode: finished.mode,
        status: finished.status,
        dryRun: finished.dryRun,
        apiFetchedCount: finished.apiFetchedCount,
        createdCount: finished.createdCount,
        updatedCount: finished.updatedCount,
        unchangedCount: finished.unchangedCount,
        skippedCount: finished.skippedCount,
        errorCount: finished.errorCount,
        estimatedJsonSaves: finished.estimatedJsonSaves,
        rawShardCount: finished.rawShardsTouched.length,
        changedFields: finished.changedFields,
        stopReason: finished.stopReason,
        lastError: finished.lastError,
        perf: getPerfSnapshot(),
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
