#!/usr/bin/env node
/**
 * FANZA 作品を画像あり・重複なしで目標件数まで拡張する CLI。
 *
 * 使い方:
 *   npm run fanza:expand -- --target=30000
 *   npm run fanza:expand -- --target=30000 --resume
 *   npm run fanza:expand -- --source=popular --target=30000
 *   npm run fanza:expand -- --dry-run
 *   npm run fanza:expand -- --source=genre,maker --dry-run
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

// Mac ローカル CLI ではカタログ書き込みを許可（Vercel では実行しない想定）
if (!process.env.VERCEL) {
  if (process.env.ADULT_LOCAL_WRITE_ENABLED === undefined) {
    process.env.ADULT_LOCAL_WRITE_ENABLED = "true";
  }
}

const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@/": `${root}/`,
    "server-only": resolve(root, "scripts/shims/server-only.mjs"),
  },
});

const ALL_SOURCES = [
  "popular",
  "new",
  "genre",
  "maker",
  "label",
  "series",
  "actress",
];

function parseArgs(argv) {
  const args = {
    target: 30000,
    batchSize: undefined,
    dryRun: false,
    resume: false,
    sourceOrder: undefined,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--resume") args.resume = true;
    else if (arg.startsWith("--target=")) args.target = Number(arg.slice(9));
    else if (arg === "--target" && argv[i + 1]) args.target = Number(argv[++i]);
    else if (arg.startsWith("--batch-size="))
      args.batchSize = Number(arg.slice(13));
    else if (arg === "--batch-size" && argv[i + 1])
      args.batchSize = Number(argv[++i]);
    else if (arg.startsWith("--source=")) {
      args.sourceOrder = arg
        .slice(9)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--source" && argv[i + 1]) {
      args.sourceOrder = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  if (args.sourceOrder) {
    const invalid = args.sourceOrder.filter((s) => !ALL_SOURCES.includes(s));
    if (invalid.length > 0) {
      throw new Error(
        `不明な source: ${invalid.join(", ")}（候補: ${ALL_SOURCES.join(", ")}）`,
      );
    }
  }

  if (!Number.isFinite(args.target) || args.target < 1) {
    throw new Error("--target は 1 以上の整数で指定してください");
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
        status: job.status,
        source: job.cursor?.source,
        entityName: job.cursor?.entityName,
        offset: job.cursor?.offset,
        currentWorkCount: job.currentWorkCount,
        targetCount: job.targetCount,
        remainingCount: job.remainingCount,
        apiFetchedCount: job.apiFetchedCount,
        newAddedCount: job.newAddedCount,
        updatedCount: job.updatedCount,
        duplicateCount: job.duplicateCount,
        noImageExcludedCount: job.noImageExcludedCount,
        errorCount: job.errorCount,
        stopReason: job.stopReason,
        lastError: job.lastError,
        lastFetchAt: job.lastFetchAt,
      },
      null,
      2,
    ),
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function printDryRunReport(job, metrics, elapsedMs) {
  const queries = metrics?.supabaseQueries ?? 0;
  const columns = metrics?.columnsRead?.length
    ? metrics.columnsRead.join(", ")
    : "(none)";
  const rows = metrics?.rowsRead ?? 0;
  const bytes = metrics?.estimatedBytes ?? 0;

  console.log("\n======== FANZA Expand Dry Run Report ========");
  console.log(`Supabase問い合わせ回数: ${queries}`);
  console.log(`読み取った列: ${columns}`);
  console.log(`読み取った行数: ${rows}`);
  console.log(`推定通信量（Egress）: ${formatBytes(bytes)} (${bytes} bytes)`);
  console.log(`新規作品数: ${job?.newAddedCount ?? 0}`);
  console.log(`重複数: ${job?.duplicateCount ?? 0}`);
  console.log(`画像なし除外数: ${job?.noImageExcludedCount ?? 0}`);
  console.log(`API取得件数: ${job?.apiFetchedCount ?? 0}`);
  console.log(`処理時間: ${(elapsedMs / 1000).toFixed(1)} s`);
  console.log("=============================================\n");
}

function printScaleEstimate(job, metrics, elapsedMs) {
  const apiFetched = Math.max(1, job?.apiFetchedCount ?? 100);
  const bytes = metrics?.estimatedBytes ?? 0;
  const bytesPerItem = bytes / apiFetched;
  const remaining = Math.max(0, (job?.targetCount ?? 30000) - (job?.currentWorkCount ?? 0));
  // Dry Run は多くが重複の可能性が高いため、新規ペースは楽観/悲観の幅で示す
  const secPerBatch = Math.max(1.5, elapsedMs / 1000);
  const batchesNeeded = Math.ceil(remaining / 100);
  const estHoursOptimistic = (batchesNeeded * secPerBatch) / 3600;
  // 新規率が低い場合はソース横断でバッチ数が増える
  const estHoursPessimistic = estHoursOptimistic * 3;
  const egressToTarget = bytesPerItem * remaining * 1.2; // count 照会分の余裕

  console.log("-------- 30,000件実行前の想定 --------");
  console.log(
    `想定処理時間: 約 ${estHoursOptimistic.toFixed(1)}〜${estHoursPessimistic.toFixed(1)} 時間（FANZA API遅延が主）`,
  );
  console.log(
    `想定Supabase Egress: 約 ${formatBytes(egressToTarget)}（候補 cid 照合 + count のみ）`,
  );
  console.log(
    `1バッチあたり通信量: 約 ${formatBytes(bytes)}（Dry Run実測ベース）`,
  );
  console.log(
    "ボトルネック: FANZA ItemList API のレート制限 / request delay（Supabase ではない）",
  );
  console.log("実行コマンド: npm run fanza:expand -- --target=30000");
  console.log("再開: npm run fanza:expand -- --resume");
  console.log("--------------------------------------\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage:
  npm run fanza:expand -- --target=30000
  npm run fanza:expand -- --target=30000 --resume
  npm run fanza:expand -- --source=popular,new --target=20000
  npm run fanza:expand -- --dry-run

Sources (default order):
  ${ALL_SOURCES.join(" → ")}

Notes:
  - 画像なし / NOW PRINTING / 取得失敗は登録しません
  - 重複は候補 content_id/cid のみを Supabase .in 照合（全件取得しない）
  - --dry-run は 100 件（1バッチ）だけ処理し Egress を計測（書込なし）
  - 30,000 件到達で停止。以降は差分同期のみ
`);
    process.exit(0);
  }

  const {
    startFanzaExpandJob,
    runFanzaExpandUntilIdle,
    getFanzaExpandCurrentWorkCount,
    resetFanzaExpandEgressMetrics,
    getFanzaExpandEgressMetrics,
  } = jiti("../lib/admin/fanza-expand-service.ts");

  resetFanzaExpandEgressMetrics();
  const startedAt = Date.now();

  const current = await getFanzaExpandCurrentWorkCount();
  console.log(
    `[fanza-expand] current=${current.toLocaleString()} target=${args.target.toLocaleString()}${
      args.dryRun ? " dry-run=100" : ""
    }`,
  );

  if (current >= args.target && !args.resume && !args.dryRun) {
    console.log(
      "[fanza-expand] 目標件数に到達済みです。差分更新（FANZA sync）のみ実行してください。",
    );
    process.exit(0);
  }

  const job = startFanzaExpandJob({
    targetCount: args.target,
    batchSize: args.batchSize ?? (args.dryRun ? 100 : undefined),
    dryRun: args.dryRun,
    resume: args.resume && !args.dryRun,
    sourceOrder: args.sourceOrder,
    forCli: true,
  });
  console.log(
    `[fanza-expand] started ${job.id} source=${job.cursor.source}${
      args.dryRun ? " (dry-run 1 batch)" : ""
    }`,
  );

  const finished = await runFanzaExpandUntilIdle({ forCli: true });
  const elapsedMs = Date.now() - startedAt;
  const metrics = getFanzaExpandEgressMetrics();

  printJob(finished);

  if (args.dryRun) {
    printDryRunReport(finished, metrics, elapsedMs);
    printScaleEstimate(finished, metrics, elapsedMs);
  }

  if (finished.status === "FAILED") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
