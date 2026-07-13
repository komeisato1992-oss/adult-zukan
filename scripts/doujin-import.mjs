#!/usr/bin/env node
/**
 * 同人図鑑 初期インポート CLI
 *
 * 使い方:
 *   npm run doujin:import:popular -- --target=100 --dry-run
 *   npm run doujin:import:popular -- --target=100
 *   npm run doujin:import:new -- --target=100 --dry-run
 *   npm run doujin:import:initial
 *   node scripts/doujin-import.mjs popular --resume
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
  let bufferKey = null;
  let bufferLines = [];
  for (const line of text.split("\n")) {
    if (bufferKey) {
      bufferLines.push(line);
      if (line.trim() === "}") {
        if (process.env[bufferKey] === undefined) {
          process.env[bufferKey] = bufferLines.join("\n");
        }
        bufferKey = null;
        bufferLines = [];
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value === "{") {
      bufferKey = key;
      bufferLines = ["{"];
      continue;
    }
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
    target: undefined,
    batchSize: undefined,
    dryRun: false,
    resume: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--resume") args.resume = true;
    else if (arg.startsWith("--target=")) args.target = Number(arg.slice(9));
    else if (arg === "--target" && argv[i + 1]) args.target = Number(argv[++i]);
    else if (arg.startsWith("--batch-size="))
      args.batchSize = Number(arg.slice(13));
    else if (arg === "--batch-size" && argv[i + 1])
      args.batchSize = Number(argv[++i]);
  }
  return args;
}

function printJob(job) {
  if (!job) {
    console.log("job: (none)");
    return;
  }
  console.log(
    JSON.stringify(
      {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        dryRun: job.dryRun,
        currentUniqueCount: job.currentUniqueCount,
        targetUniqueCount: job.targetUniqueCount,
        apiFetchedCount: job.apiFetchedCount,
        apiSearchTotalCount: job.apiSearchTotalCount,
        newCreatedCount: job.newCreatedCount,
        updatedCount: job.updatedCount,
        duplicateCount: job.duplicateCount,
        popularOverlapCount: job.popularOverlapCount,
        existingDbDuplicateCount: job.existingDbDuplicateCount,
        skippedCount: job.skippedCount,
        errorCount: job.errorCount,
        currentOffset: job.currentOffset,
        nextOffset: job.nextOffset,
        stopReason: job.stopReason,
        lastError: job.lastError,
      },
      null,
      2,
    ),
  );
}

async function runJob(jobType, options) {
  const {
    startDoujinImportJob,
    runDoujinImportUntilIdle,
  } = jiti("../lib/doujin/import-service.ts");

  const job = startDoujinImportJob(jobType, {
    targetUniqueCount: options.target,
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    resume: options.resume,
    site: "FANZA",
    service: "doujin",
    floor: "digital_doujin",
  });
  console.log(`[doujin-import] started ${job.id}`);
  const finished = await runDoujinImportUntilIdle(job.id);
  printJob(finished);
  return finished;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.mode === "help" || args.mode === "--help") {
    console.log(`Usage:
  node scripts/doujin-import.mjs popular [--target=4000] [--dry-run] [--resume] [--batch-size=100]
  node scripts/doujin-import.mjs new [--target=1000] [--dry-run] [--resume] [--batch-size=100]
  node scripts/doujin-import.mjs initial   # popular 4000 then new 1000
`);
    process.exit(0);
  }

  if (args.mode === "popular") {
    await runJob("POPULAR_INITIAL_IMPORT", args);
    return;
  }
  if (args.mode === "new") {
    await runJob("NEW_INITIAL_IMPORT", args);
    return;
  }
  if (args.mode === "initial") {
    const popular = await runJob("POPULAR_INITIAL_IMPORT", {
      ...args,
      target: args.target ?? 4000,
      dryRun: false,
      resume: args.resume,
    });
    if (popular.status !== "COMPLETED") {
      console.error("[doujin-import] popular did not complete; abort new phase");
      process.exit(1);
    }
    await runJob("NEW_INITIAL_IMPORT", {
      target: 1000,
      batchSize: args.batchSize,
      dryRun: false,
      resume: false,
    });
    return;
  }

  console.error(`Unknown mode: ${args.mode}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
