#!/usr/bin/env node
/**
 * 第4段階: Supabase works テーブルへ100件追加テスト
 *
 * 必須: .env.local に SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * 事前: supabase/migrations/20260715_works_master.sql を適用
 *
 *   node scripts/test-works-master-add-100.mjs
 *   node scripts/test-works-master-add-100.mjs --count 100 --offset 12000
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
  const args = { count: 100, offset: 12000 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--count" && argv[i + 1]) args.count = Number(argv[++i]);
    if (argv[i] === "--offset" && argv[i + 1]) args.offset = Number(argv[++i]);
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

function trackedPorcelain(raw) {
  return raw
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.includes("works-master.json") &&
        !line.includes("work-live-status.json"),
    )
    .join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();
  const beforeGit = gitPorcelain();

  const {
    isWorksMasterSupabaseConfigured,
    getConfiguredWorksMasterBackend,
    getWorksMasterStorageInfo,
    fetchPublishedWorksMasterAsDmmItems,
    resetWorksMasterMetrics,
  } = (() => {
    const mod = jiti("../lib/dmm/works-master/index.ts");
    const metrics = jiti("../lib/dmm/works-master/metrics.ts");
    return {
      ...mod,
      resetWorksMasterMetrics: metrics.resetWorksMasterMetrics,
    };
  })();

  if (!isWorksMasterSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local に追加してから再実行してください。",
    );
  }

  const backend = getConfiguredWorksMasterBackend();
  if (backend !== "supabase") {
    throw new Error(
      `backend が supabase ではありません: ${backend}. WORKS_MASTER_BACKEND=auto を推奨します。`,
    );
  }

  resetWorksMasterMetrics();

  const { fetchImportCandidates, parseFetchCandidatesRequest } = jiti(
    "../lib/admin/fetch-import-candidates.ts",
  );
  const { buildAddSelectedWorksPayload } = jiti(
    "../lib/admin/import-add-payload.ts",
  );
  const { addSelectedWorksToCatalog } = jiti(
    "../lib/admin/add-selected-works.ts",
  );
  const { supabaseCountWorkMasterRows, supabaseFetchWorkMasterByCids } = jiti(
    "../lib/dmm/works-master/supabase-store.ts",
  );

  const countBefore = await supabaseCountWorkMasterRows();
  const scanCount = Math.max(args.count * 3, 200);
  const fetchResult = await fetchImportCandidates(
    parseFetchCandidatesRequest({
      sort: "popular",
      startOffset: args.offset,
      requestedCount: scanCount,
    }),
  );

  const candidates = fetchResult.candidates.slice(0, args.count);
  if (candidates.length < args.count) {
    throw new Error(
      `候補不足: 要求${args.count}件 / 取得${candidates.length}件（offset=${args.offset}）`,
    );
  }

  const payload = buildAddSelectedWorksPayload(candidates);
  const result = await addSelectedWorksToCatalog(payload.works);

  if (result.committedToGitHub) {
    throw new Error("GitHub commit が発生しました（禁止）");
  }
  if (result.summary.storageTarget !== "supabase") {
    throw new Error(
      `保存先が supabase ではありません: ${result.summary.storageTarget} (fallback=${result.summary.usedJsonFallback})`,
    );
  }
  if (result.summary.usedJsonFallback) {
    throw new Error(
      `Supabase障害でJSONフォールバックしました: ${result.summary.jsonFallbackCount}件`,
    );
  }
  if ((result.summary.supabaseSavedCount ?? 0) < args.count) {
    throw new Error(
      `Supabase保存件数が不足: ${result.summary.supabaseSavedCount} / ${args.count}`,
    );
  }

  const countAfter = await supabaseCountWorkMasterRows();
  const addedIds = result.addedContentIds ?? [];
  const fromDb = await supabaseFetchWorkMasterByCids(addedIds.slice(0, 5));
  if (fromDb.size === 0) {
    throw new Error("Supabase works から追加CIDを読み戻せませんでした");
  }

  const published = await fetchPublishedWorksMasterAsDmmItems();
  const publishedIds = new Set(published.map((item) => item.content_id));
  const visibleCount = addedIds.filter((id) => publishedIds.has(id)).length;
  if (visibleCount < Math.min(5, addedIds.length)) {
    throw new Error(
      `公開マージにSupabase作品が見つかりません visible=${visibleCount}`,
    );
  }

  const afterGit = gitPorcelain();
  const storage = await getWorksMasterStorageInfo();

  console.log(
    JSON.stringify(
      {
        ok: true,
        supabaseSavedCount: result.summary.supabaseSavedCount ?? 0,
        jsonFallbackCount: result.summary.jsonFallbackCount ?? 0,
        addedCount: result.summary.addedCount,
        storageTarget: result.summary.storageTarget,
        usedJsonFallback: result.summary.usedJsonFallback,
        committedToGitHub: result.committedToGitHub,
        supabaseRowCountBefore: countBefore,
        supabaseRowCountAfter: countAfter,
        publicVisibleSample: visibleCount,
        deployOccurred: false,
        gitTrackedChanged:
          trackedPorcelain(beforeGit) !== trackedPorcelain(afterGit),
        rowCountAfter: storage.rowCount,
        reflectMs: Date.now() - startedAt,
        messageFirstLine: result.message.split("\n")[0],
      },
      null,
      2,
    ),
  );

  if (trackedPorcelain(beforeGit) !== trackedPorcelain(afterGit)) {
    console.error("[test] unexpected tracked git porcelain change");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[test-works-master-add-100] failed", error);
  process.exitCode = 1;
});
