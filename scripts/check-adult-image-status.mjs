#!/usr/bin/env node
/**
 * works.image_status 一括確認（ローカル専用）
 *
 * Vercel / 通常閲覧では実行しない。Cursor ローカルターミナルからのみ。
 * published / manual_hidden は変更しない（画像状態の確認のみ）。
 *
 *   npm run adult:image-check
 *   npm run adult:image-check -- --all
 *   npm run adult:image-check -- --dry-run
 *   npm run adult:image-check -- --limit=20
 *   npm run adult:image-check -- --cids=bonu00047,bagr00091,apak00335
 *   npm run adult:image-check:reset
 */

import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PROGRESS_PATH = resolve(
  ROOT,
  "data/runtime/adult-image-check-progress.json",
);

const DEFAULT_BATCH_SIZE = 300;
const DEFAULT_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 10_000;
const RETRY_COUNT = 1;
const DELAY_MIN_MS = 200;
const DELAY_MAX_MS = 500;
const RATE_LIMIT_WAIT_MS = 60_000;
const MAX_RATE_LIMIT_HITS = 3;

const SELECT_COLS =
  "cid,package_image,image_status,image_status_checked_at,published";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const key = s.slice(0, i).trim();
    const value = s
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));
loadEnv(resolve(ROOT, ".env"));

function parseArgs(argv) {
  const args = {
    all: false,
    reset: false,
    dryRun: false,
    yes: false,
    batchSize: DEFAULT_BATCH_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
    limit: null,
    cids: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--reset") args.reset = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--yes" || arg === "-y") args.yes = true;
    else if (arg === "--batch-size" && argv[i + 1]) {
      args.batchSize = Number(argv[++i]);
    } else if (arg.startsWith("--batch-size=")) {
      args.batchSize = Number(arg.slice("--batch-size=".length));
    } else if (arg === "--concurrency" && argv[i + 1]) {
      args.concurrency = Number(argv[++i]);
    } else if (arg.startsWith("--concurrency=")) {
      args.concurrency = Number(arg.slice("--concurrency=".length));
    } else if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number(argv[++i]);
    } else if (arg.startsWith("--limit=")) {
      args.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--cids" && argv[i + 1]) {
      args.cids = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--cids=")) {
      args.cids = arg
        .slice("--cids=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.batchSize) || args.batchSize < 1) {
    throw new Error(`無効な --batch-size: ${args.batchSize}`);
  }
  if (args.batchSize > 500) {
    console.warn(
      `[warn] batch-size=${args.batchSize} は大きめです。推奨は 100〜300。`,
    );
  }
  if (
    !Number.isFinite(args.concurrency) ||
    args.concurrency < 1 ||
    args.concurrency > 3
  ) {
    throw new Error(
      `無効な --concurrency: ${args.concurrency}（1〜3 のみ可）`,
    );
  }
  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error(`無効な --limit: ${args.limit}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/check-adult-image-status.mjs [options]

Options:
  --all                 全件再確認（デフォルトは image_status IS NULL のみ）
  --batch-size=N        バッチサイズ（初期値 300）
  --concurrency=N       同時接続数 1〜3（初期値 3）
  --limit=N             最大処理件数（テスト用）
  --cids=a,b,c          指定 CID のみ確認
  --dry-run             対象件数と設定のみ表示（GET / DB更新なし）
  --reset               進捗ファイルを削除して終了
  --yes, -y             確認プロンプトをスキップ
`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelayMs() {
  return (
    DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1))
  );
}

function urlIndicatesNowPrinting(url) {
  if (url == null) return false;
  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("now_printing") || normalized.includes("noimage")
  );
}

function createEmptyProgress(mode) {
  const now = new Date().toISOString();
  return {
    mode,
    lastProcessedOffset: 0,
    processedCount: 0,
    okCount: 0,
    nowPrintingCount: 0,
    fetchFailedCount: 0,
    startedAt: now,
    updatedAt: now,
  };
}

function loadProgress(mode) {
  if (!existsSync(PROGRESS_PATH)) return createEmptyProgress(mode);
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_PATH, "utf8"));
    if (raw.mode && raw.mode !== mode) {
      console.warn(
        `[warn] 進捗ファイルの mode=${raw.mode} が今回の mode=${mode} と異なります。進捗を新規開始します。`,
      );
      return createEmptyProgress(mode);
    }
    return {
      mode,
      lastProcessedOffset: Number(raw.lastProcessedOffset) || 0,
      processedCount: Number(raw.processedCount) || 0,
      okCount: Number(raw.okCount) || 0,
      nowPrintingCount: Number(raw.nowPrintingCount) || 0,
      fetchFailedCount: Number(raw.fetchFailedCount) || 0,
      startedAt: raw.startedAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  } catch {
    console.warn("[warn] 進捗ファイルの読み込みに失敗。新規開始します。");
    return createEmptyProgress(mode);
  }
}

function saveProgress(progress) {
  mkdirSync(dirname(PROGRESS_PATH), { recursive: true });
  const next = { ...progress, updatedAt: new Date().toISOString() };
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function resetProgress() {
  if (existsSync(PROGRESS_PATH)) {
    unlinkSync(PROGRESS_PATH);
    console.log(`進捗をリセットしました: ${PROGRESS_PATH}`);
  } else {
    console.log("進捗ファイルはありません（既にリセット済み）");
  }
}

function getSupabaseEnv() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";
  return { url, serviceKey };
}

function createSupabase() {
  const { url, serviceKey } = getSupabaseEnv();
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function confirmOrExit(message, yes) {
  if (yes) return;
  if (!process.stdin.isTTY) {
    console.error(
      "対話入力が使えないため中止しました。続行する場合は --yes を付けてください。",
    );
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(message, (v) => {
      rl.close();
      resolve(String(v || "").trim().toLowerCase());
    });
  });
  if (answer !== "y" && answer !== "yes") {
    console.log("中止しました。");
    process.exit(0);
  }
}

async function preflight(client) {
  const { error: pingError } = await client.from("works").select("cid").limit(1);
  if (pingError) {
    throw new Error(`Supabase 接続失敗: ${pingError.message}`);
  }

  const { error: colError } = await client
    .from("works")
    .select("image_status,image_status_checked_at")
    .limit(1);
  if (colError) {
    throw new Error(
      `works.image_status / image_status_checked_at 列の確認に失敗: ${colError.message}`,
    );
  }
}

async function countWorks(client, filter) {
  let q = client.from("works").select("cid", { count: "exact", head: true });
  if (filter === "unchecked") q = q.is("image_status", null);
  const { count, error } = await q;
  if (error) throw new Error(`件数取得失敗: ${error.message}`);
  return count ?? 0;
}

async function fetchBatch(client, { all, offset, batchSize, cids }) {
  if (cids?.length) {
    const { data, error } = await client
      .from("works")
      .select(SELECT_COLS)
      .in("cid", cids)
      .order("cid", { ascending: true });
    if (error) throw new Error(`作品取得失敗: ${error.message}`);
    return data ?? [];
  }

  // unchecked: 処理済みは null 集合から外れるため常に先頭から取得（offset は使わない）
  // --all: lastProcessedOffset から range で再開
  let q = client.from("works").select(SELECT_COLS);
  if (!all) q = q.is("image_status", null);
  q = q
    .order("cid", { ascending: true })
    .range(all ? offset : 0, (all ? offset : 0) + batchSize - 1);

  const { data, error } = await q;
  if (error) throw new Error(`作品取得失敗: ${error.message}`);
  return data ?? [];
}

/**
 * A/B/C/D 判定（通常閲覧では呼ばない）
 */
async function detectImageStatus(packageImage, rateLimitState) {
  const trimmed = packageImage?.trim() || null;
  if (!trimmed) return "fetch_failed";

  if (urlIndicatesNowPrinting(trimmed)) return "now_printing";

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    await sleep(randomDelayMs());
    try {
      const res = await fetch(trimmed, {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "adult-zukan-image-check/1.0 (local batch)",
          Accept: "image/*,*/*",
        },
      });

      if (res.status === 429) {
        rateLimitState.hits += 1;
        console.warn(
          `[429] rate limited (hit ${rateLimitState.hits}/${MAX_RATE_LIMIT_HITS}). waiting ${RATE_LIMIT_WAIT_MS}ms…`,
        );
        if (rateLimitState.hits >= MAX_RATE_LIMIT_HITS) {
          throw new Error(
            "RATE_LIMIT_STOP: 429 が連続したため安全停止します。しばらくしてから同じコマンドで再開してください。",
          );
        }
        await sleep(RATE_LIMIT_WAIT_MS);
        lastError = new Error("HTTP 429");
        continue;
      }

      const finalUrl = res.url || trimmed;
      if (urlIndicatesNowPrinting(finalUrl)) return "now_printing";
      if (!res.ok) return "fetch_failed";
      return "ok";
    } catch (err) {
      lastError = err;
      if (String(err?.message || "").startsWith("RATE_LIMIT_STOP")) throw err;
      if (attempt < RETRY_COUNT) {
        await sleep(500 + randomDelayMs());
        continue;
      }
    }
  }

  void lastError;
  return "fetch_failed";
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await mapper(items[i], i);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function updateOneWithRetry(client, row, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { error } = await client
        .from("works")
        .update({
          image_status: row.image_status,
          image_status_checked_at: row.image_status_checked_at,
        })
        .eq("cid", row.cid);
      if (!error) return;
      lastError = error;
    } catch (err) {
      lastError = err;
    }
    await sleep(400 * attempt);
  }
  const msg = lastError?.message || String(lastError);
  throw new Error(`バッチ保存失敗 (${row.cid}): ${msg}`);
}

async function saveBatch(client, updates) {
  if (updates.length === 0) return 0;

  // バッチ終了時にまとめて更新（image_status 系のみ。published 等は触らない）
  // 部分 upsert は slug/title の NOT NULL で失敗するため update を使う。
  // Supabase への過負荷を避けるため保存並列は最大 8、失敗時はリトライ。
  const SAVE_CONCURRENCY = 8;
  let saved = 0;
  let next = 0;

  async function worker() {
    while (next < updates.length) {
      const i = next;
      next += 1;
      await updateOneWithRetry(client, updates[i]);
      saved += 1;
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SAVE_CONCURRENCY, updates.length) },
      () => worker(),
    ),
  );
  return saved;
}

function printProgress(progress, totalTarget) {
  const totalLabel =
    totalTarget == null ? "?" : totalTarget.toLocaleString("en-US");
  console.log("");
  console.log(
    `Processed: ${progress.processedCount.toLocaleString("en-US")} / ${totalLabel}`,
  );
  console.log(`OK: ${progress.okCount.toLocaleString("en-US")}`);
  console.log(
    `NOW PRINTING: ${progress.nowPrintingCount.toLocaleString("en-US")}`,
  );
  console.log(
    `FETCH FAILED: ${progress.fetchFailedCount.toLocaleString("en-US")}`,
  );
  console.log(
    `Next offset: ${progress.lastProcessedOffset.toLocaleString("en-US")}`,
  );
}

async function reportFinalStats(client) {
  const [
    total,
    ok,
    nowPrinting,
    fetchFailed,
    unchecked,
    publishedNowPrinting,
  ] = await Promise.all([
    countWorks(client, "all"),
    countByStatus(client, "ok"),
    countByStatus(client, "now_printing"),
    countByStatus(client, "fetch_failed"),
    countWorks(client, "unchecked"),
    countPublishedNowPrinting(client),
  ]);

  console.log("");
  console.log("=== Supabase 集計 ===");
  console.log(`総作品数: ${total.toLocaleString("en-US")}`);
  console.log(`ok: ${ok.toLocaleString("en-US")}`);
  console.log(`now_printing: ${nowPrinting.toLocaleString("en-US")}`);
  console.log(`fetch_failed: ${fetchFailed.toLocaleString("en-US")}`);
  console.log(`未確認 (null): ${unchecked.toLocaleString("en-US")}`);
  console.log(
    `公開中の now_printing: ${publishedNowPrinting.toLocaleString("en-US")}`,
  );
  console.log("");
  console.log(
    "注: fetch_failed は自動非公開しません。管理画面の「画像なし」は now_printing を中心に扱います。",
  );
}

async function countByStatus(client, status) {
  const { count, error } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("image_status", status);
  if (error) throw new Error(`集計失敗 (${status}): ${error.message}`);
  return count ?? 0;
}

async function countPublishedNowPrinting(client) {
  const { count, error } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("image_status", "now_printing")
    .eq("published", true);
  if (error) {
    throw new Error(`公開中 now_printing 集計失敗: ${error.message}`);
  }
  return count ?? 0;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.reset) {
    resetProgress();
    return;
  }

  const mode = args.cids?.length
    ? "cids"
    : args.all
      ? "all"
      : "unchecked";

  console.log("=== adult image-status 一括確認（ローカル専用） ===");
  console.log(`進捗ファイル: ${PROGRESS_PATH}`);
  console.log(`mode: ${mode}`);
  console.log(`batch-size: ${args.batchSize}`);
  console.log(`concurrency: ${args.concurrency}`);
  console.log(`timeout: ${FETCH_TIMEOUT_MS}ms`);
  console.log(`retry: ${RETRY_COUNT}`);
  console.log(`delay: ${DELAY_MIN_MS}–${DELAY_MAX_MS}ms / request`);
  console.log(`dry-run: ${args.dryRun}`);
  if (args.limit) console.log(`limit: ${args.limit}`);
  if (args.cids?.length) console.log(`cids: ${args.cids.join(", ")}`);

  const client = createSupabase();
  await preflight(client);
  console.log("preflight: Supabase OK / image_status 列 OK");

  let progress = loadProgress(mode);
  if (args.cids?.length) {
    // CID 指定は毎回フル実行（進捗オフセットは使わない）
    progress = createEmptyProgress(mode);
  }

  let remainingNow;
  if (args.cids?.length) {
    remainingNow = args.cids.length;
  } else if (args.all) {
    const allCount = await countWorks(client, "all");
    remainingNow = Math.max(0, allCount - progress.lastProcessedOffset);
  } else {
    remainingNow = await countWorks(client, "unchecked");
  }

  if (args.limit != null) {
    remainingNow = Math.min(remainingNow, args.limit);
  }

  // 表示用総数: 未確認は「これまでの処理済み + 残り」、--all は全体件数
  const targetTotal = args.all
    ? await countWorks(client, "all")
    : args.cids?.length
      ? args.cids.length
      : progress.processedCount + remainingNow;

  console.log(
    `今回処理予定: ${remainingNow.toLocaleString("en-US")} 件` +
      (args.all
        ? ` (再開 offset=${progress.lastProcessedOffset})`
        : args.cids?.length
          ? " (CID指定)"
          : ` / 累計目標 ${targetTotal.toLocaleString("en-US")}`),
  );

  if (args.dryRun) {
    console.log("");
    console.log("[dry-run] 画像 GET / DB 更新は行いません。");
    console.log(
      `再開時 offset: ${progress.lastProcessedOffset} / processed: ${progress.processedCount}`,
    );
    return;
  }

  await confirmOrExit(
    `この設定で image_status 確認を開始しますか？ (y/N): `,
    args.yes || Boolean(args.cids?.length) || Boolean(args.limit),
  );

  const rateLimitState = { hits: 0 };
  let sessionProcessed = 0;
  const sessionCap = args.limit ?? Infinity;

  // --all 再開: lastProcessedOffset から
  // unchecked / cids: クエリ側で先頭 or 指定取得
  let offset = args.all ? progress.lastProcessedOffset : 0;

  while (sessionProcessed < sessionCap) {
    const remaining = sessionCap - sessionProcessed;
    const batchSize = Math.min(args.batchSize, remaining);

    const rows = await fetchBatch(client, {
      all: args.all,
      offset,
      batchSize,
      cids: args.cids,
    });

    if (rows.length === 0) {
      console.log("対象作品がなくなりました。完了です。");
      break;
    }

    console.log("");
    console.log(
      `--- batch: ${rows.length}件 (offset=${offset}, concurrency=${args.concurrency}) ---`,
    );

    const detected = await mapPool(
      rows,
      args.concurrency,
      async (row) => {
        const status = await detectImageStatus(
          row.package_image,
          rateLimitState,
        );
        return {
          cid: row.cid,
          image_status: status,
          image_status_checked_at: new Date().toISOString(),
          _prev: row.image_status,
          _url: row.package_image,
        };
      },
    );

    const updates = detected.map(
      ({ cid, image_status, image_status_checked_at }) => ({
        cid,
        image_status,
        image_status_checked_at,
      }),
    );

    await saveBatch(client, updates);

    for (const item of detected) {
      progress.processedCount += 1;
      sessionProcessed += 1;
      if (item.image_status === "ok") progress.okCount += 1;
      else if (item.image_status === "now_printing") {
        progress.nowPrintingCount += 1;
      } else progress.fetchFailedCount += 1;
    }

    if (args.all) {
      offset += rows.length;
      progress.lastProcessedOffset = offset;
    } else if (args.cids?.length) {
      progress.lastProcessedOffset = sessionProcessed;
    } else {
      // unchecked: 集合が縮むのでクエリは常に先頭。表示用に累計を記録
      progress.lastProcessedOffset = progress.processedCount;
    }

    progress = saveProgress(progress);
    printProgress(progress, targetTotal);

    // サンプルログ（バッチ先頭数件）
    for (const item of detected.slice(0, 5)) {
      console.log(
        `  ${item.cid}: ${item._prev ?? "null"} → ${item.image_status}`,
      );
    }

    if (args.cids?.length) break;
    if (rows.length < batchSize) {
      console.log("最終バッチを処理しました。");
      break;
    }
  }

  console.log("");
  console.log("=== 実行セッション完了 ===");
  printProgress(progress, targetTotal);
  await reportFinalStats(client);

  if (args.cids?.length) {
    console.log("=== CID 指定テスト結果 ===");
    const { data, error } = await client
      .from("works")
      .select("cid,image_status,image_status_checked_at,package_image")
      .in("cid", args.cids)
      .order("cid", { ascending: true });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      console.log(
        `${row.cid}: image_status=${row.image_status} checked_at=${row.image_status_checked_at}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("");
  console.error("[fatal]", err?.message || err);
  if (String(err?.message || "").startsWith("RATE_LIMIT_STOP")) {
    console.error(
      "進捗は保存済みです。時間を置いて同じコマンドで再開してください。",
    );
  }
  process.exit(1);
});
