#!/usr/bin/env node
/**
 * FANZA TV 見放題判定ワーカー（Macローカル・detached）
 *
 * 管理画面 API から spawn される。Cursor / next dev を閉じても継続する。
 *
 *   node scripts/run-fanza-tv-check.mjs
 *   npm run fanza-tv:check -- --limit=100
 *   npm run fanza-tv:check -- --limit=500
 *   npm run fanza-tv:check -- --limit=1000
 *   npm run fanza-tv:check -- --limit=5000
 *   npm run fanza-tv:check -- --limit=all
 *   npm run fanza-tv:check -- --fresh --limit=1000
 *   npm run fanza-tv:check -- --limit=1000 --fetch-only
 */

import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JOB_PATH = path.join(ROOT, "data/dmm/fanza-tv-check-job.json");
const STATE_PATH = path.join(ROOT, ".playwright", "fanza-tv-storage-state.json");
const PROFILE_DIR = path.join(ROOT, ".playwright", "fanza-tv-profile");
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const PAUSE_MS = 400;

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    if (trimmed.startsWith("{")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readJob() {
  if (!existsSync(JOB_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(JOB_PATH, "utf8"));
    return raw?.currentJob ?? null;
  } catch {
    return null;
  }
}

function writeJob(job) {
  mkdirSync(path.dirname(JOB_PATH), { recursive: true });
  writeFileSync(
    JOB_PATH,
    `${JSON.stringify({ currentJob: job }, null, 2)}\n`,
    "utf8",
  );
}

function buildUrl(cid) {
  return `https://tv.dmm.co.jp/list/?viewing_plans=FANZA_TV&content=${encodeURIComponent(cid)}`;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY が未設定です");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertWorksSchema(client) {
  const { error } = await client
    .from("works")
    .select("fanza_tv_status,fanza_tv_checked_at,fanza_tv_url")
    .limit(1);
  if (error) {
    throw new Error(
      "works に fanza_tv_* 列がありません。supabase/migrations/20260716_004_works_fanza_tv.sql を適用してください",
    );
  }
}

/** FANZA TV判定結果は works のみへ保存 */
async function saveBatch(client, rows) {
  for (const row of rows) {
    const { error } = await client
      .from("works")
      .update({
        fanza_tv_status: row.status,
        fanza_tv_checked_at: row.checkedAt,
        fanza_tv_url: row.url,
        updated_at: row.checkedAt,
      })
      .eq("cid", row.cid);
    if (error) {
      throw new Error(`works update failed ${row.cid}: ${error.message}`);
    }
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} cid
 */
async function checkOne(page, cid) {
  const url = buildUrl(cid);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await sleep(700);

      const httpStatus = response?.status() ?? 0;
      const finalUrl = page.url();
      const bodyText = await page
        .locator("body")
        .innerText({ timeout: 5000 })
        .catch(() => "");

      if (
        httpStatus === 404 ||
        /お探しのページ|ページが見つかり|Not Found|404/.test(bodyText)
      ) {
        return { status: "unavailable", url: finalUrl || url };
      }

      if (
        /該当する作品がありません|作品が見つかりません|配信されていません|この作品は見放題対象外|対象外です/.test(
          bodyText,
        )
      ) {
        return { status: "unavailable", url: finalUrl || url };
      }

      const verdict = await page.evaluate((targetCid) => {
        const html = document.documentElement?.innerHTML || "";
        const text = document.body?.innerText || "";
        const packs = document.querySelectorAll(
          '[data-testid="itemPackage"], [class*="itemPackage"]',
        );
        const hasCid =
          html.includes(targetCid) ||
          html.includes(`content=${targetCid}`) ||
          html.includes(`content%3D${targetCid}`);
        const hasPlayer = Boolean(
          document.querySelector(
            'video, [data-testid="contentDetail"], [class*="Player"], [class*="player"]',
          ),
        );
        const empty =
          /該当する作品がありません|作品が見つかりません|配信されていません/.test(
            text,
          );
        if (empty) return "unavailable";
        if (packs.length > 0 && hasCid) return "available";
        if (hasPlayer && hasCid) return "available";
        if (hasCid && packs.length > 0) return "available";
        // content= 付きで一覧に何も出ない場合は対象外扱い
        if (packs.length === 0 && !hasPlayer) return "unavailable";
        if (hasCid) return "available";
        return "unavailable";
      }, cid);

      return {
        status: verdict === "available" ? "available" : "unavailable",
        url: finalUrl || url,
      };
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "check failed"));
}

async function launchBrowser() {
  if (existsSync(PROFILE_DIR)) {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1440, height: 1000 },
    });
    const page = context.pages()[0] || (await context.newPage());
    return { kind: "persistent", browser: null, context, page };
  }

  if (!existsSync(STATE_PATH)) {
    throw new Error(
      `Playwright プロファイルがありません: ${path.relative(ROOT, STATE_PATH)} または ${path.relative(ROOT, PROFILE_DIR)}`,
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  return { kind: "storage", browser, context, page };
}

function hasCliFlag(name) {
  return process.argv.some(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`),
  );
}

/**
 * `--limit=1000` / `--limit 1000` / `--limit=all` を解釈する。
 * @returns {{ kind: 'default' } | { kind: 'all' } | { kind: 'number', value: number }}
 */
function parseCliLimit() {
  const argv = process.argv;
  let raw = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--limit=")) {
      raw = a.slice("--limit=".length);
      break;
    }
    if (a === "--limit") {
      raw = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[i + 1] : "";
      break;
    }
  }
  if (raw == null) return { kind: "default" };
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized || normalized === "all") return { kind: "all" };
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `不正な --limit です: ${raw}（例: 100 / 500 / 1000 / 5000 / all）`,
    );
  }
  return { kind: "number", value: Math.floor(n) };
}

function formatRequestedLimit(parsed) {
  if (parsed.kind === "all") return "all";
  if (parsed.kind === "number") return parsed.value;
  return 100;
}

function resolveNumericLimit(parsed) {
  if (parsed.kind === "all") return null;
  if (parsed.kind === "number") return parsed.value;
  return 100;
}

function printCountsHeader(requested, fetched, note = "") {
  console.log(`Requested : ${requested}`);
  console.log(`Fetched   : ${fetched}${note ? ` ${note}` : ""}`);
}

function printRunSummary({
  requested,
  fetched,
  processed,
  updated,
  success,
  failed,
  available,
  unavailable,
  remainingUnknown,
  includeHeader = true,
}) {
  if (includeHeader) {
    printCountsHeader(requested, fetched);
  }
  console.log(`Processed : ${processed}`);
  console.log(`Updated   : ${updated}`);
  console.log("");
  console.log(`success              : ${success}`);
  console.log(`failed               : ${failed}`);
  console.log(`available            : ${available}`);
  console.log(`unavailable          : ${unavailable}`);
  console.log(`remaining unknown    : ${remainingUnknown}`);
}

async function countUnknownWorks(client) {
  const { count, error } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("fanza_tv_status", "unknown");
  if (error) throw error;
  return count ?? 0;
}

async function fetchUnknownCids(client, limit) {
  const cids = [];
  let from = 0;
  const pageSize = 1000;
  const wantsAll = limit == null;
  while (wantsAll || cids.length < limit) {
    const end = from + pageSize - 1;
    const { data, error } = await client
      .from("works")
      .select("cid")
      .eq("fanza_tv_status", "unknown")
      .order("cid", { ascending: true })
      .range(from, end);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.cid) cids.push(String(row.cid));
      if (!wantsAll && cids.length >= limit) break;
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return wantsAll ? cids : cids.slice(0, limit);
}

/**
 * CLI 用ジョブ作成。--limit / --fresh 指定時は既存ジョブを破棄して新規作成。
 */
async function ensureCliJob(options = {}) {
  const forceNew = Boolean(options.forceNew);
  const existing = readJob();

  if (
    !forceNew &&
    existing &&
    (existing.status === "running" || existing.status === "pending")
  ) {
    return {
      job: existing,
      requested: existing.limit === "all" || existing.limit == null
        ? "all"
        : existing.limit,
      fetched: existing.targetCount,
      resumed: true,
    };
  }

  if (
    !forceNew &&
    existing &&
    (existing.status === "stopped" || existing.status === "failed") &&
    Array.isArray(existing.pendingCids) &&
    existing.pendingCids.length > 0
  ) {
    return {
      job: existing,
      requested: existing.limit === "all" || existing.limit == null
        ? "all"
        : existing.limit,
      fetched: existing.targetCount,
      resumed: true,
    };
  }

  loadEnvLocal();
  const client = getSupabase();
  await assertWorksSchema(client);

  const parsed = parseCliLimit();
  const requested = formatRequestedLimit(parsed);
  const numericLimit = resolveNumericLimit(parsed);

  const cids = await fetchUnknownCids(client, numericLimit);

  const now = new Date().toISOString();
  const job = {
    jobId: `fanza-tv-cli-${Date.now()}`,
    status: "running",
    mode: "limit",
    limit: requested,
    targetCount: cids.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    availableCount: 0,
    unavailableCount: 0,
    updatedCount: 0,
    pendingCids: cids,
    currentCid: null,
    batchSize: BATCH_SIZE,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    elapsedMs: 0,
    estimatedRemainingMs: null,
    stopRequested: false,
    pid: process.pid,
    message: `CLI 判定開始（${cids.length}件 / requested=${requested}）`,
    lastError: null,
    profilePath: existsSync(PROFILE_DIR) ? PROFILE_DIR : STATE_PATH,
    logPath: null,
  };
  writeJob(job);
  return { job, requested, fetched: cids.length, resumed: false };
}

async function main() {
  loadEnvLocal();
  process.chdir(ROOT);

  const forceNew = hasCliFlag("fresh") || hasCliFlag("limit");
  const spawnedByApi = hasCliFlag("job") && !hasCliFlag("limit");

  let job = null;
  let requested = null;
  let fetched = null;

  if (spawnedByApi) {
    job = readJob();
    if (!job) {
      console.error("ジョブがありません（API spawn）。");
      process.exit(1);
    }
    requested = job.limit ?? job.targetCount;
    fetched = job.targetCount;
    printCountsHeader(requested, fetched, "(api job)");
  } else {
    const created = await ensureCliJob({ forceNew });
    job = created.job;
    requested = created.requested;
    fetched = created.fetched;
    // 長時間判定の前に件数を出す（最終サマリーでも再表示）
    if (!hasCliFlag("fetch-only")) {
      printCountsHeader(
        requested,
        fetched,
        created.resumed ? "(resume existing job)" : "",
      );
    }
  }

  if (hasCliFlag("fetch-only")) {
    const client = getSupabase();
    await assertWorksSchema(client);
    const remainingUnknown = await countUnknownWorks(client);
    // 判定はせず取得件数だけ確認して終了
    job.status = "stopped";
    job.stopRequested = true;
    job.message = `fetch-only（requested=${requested}, fetched=${fetched}）`;
    job.updatedAt = new Date().toISOString();
    job.pendingCids = [];
    writeJob(job);
    printRunSummary({
      requested,
      fetched,
      processed: 0,
      updated: 0,
      success: 0,
      failed: 0,
      available: 0,
      unavailable: 0,
      remainingUnknown,
      includeHeader: true,
    });
    return;
  }

  const client = getSupabase();
  await assertWorksSchema(client);

  job.status = "running";
  job.stopRequested = false;
  job.pid = process.pid;
  job.updatedAt = new Date().toISOString();
  job.message = "Playwright で判定中…";
  job.updatedCount = Number(job.updatedCount ?? 0) || 0;
  writeJob(job);

  const startedMs = Date.parse(job.startedAt) || Date.now();
  let session = null;
  const pendingBatch = [];
  let updatedInSession = 0;

  try {
    session = await launchBrowser();
    const { page } = session;

    while (job.pendingCids.length > 0) {
      const latest = readJob();
      if (latest?.stopRequested || latest?.status === "stopped") {
        job = {
          ...job,
          ...latest,
          status: "stopped",
          stopRequested: true,
          currentCid: null,
          message: `途中停止（処理済 ${job.processedCount}/${job.targetCount}）`,
          updatedAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedMs,
        };
        if (pendingBatch.length > 0) {
          await saveBatch(client, pendingBatch);
          updatedInSession += pendingBatch.length;
          job.updatedCount = (job.updatedCount || 0) + pendingBatch.length;
          pendingBatch.length = 0;
        }
        writeJob(job);
        console.log("[fanza-tv-check] stopped", {
          processed: job.processedCount,
          remaining: job.pendingCids.length,
        });
        break;
      }

      const cid = job.pendingCids[0];
      job.currentCid = cid;
      job.updatedAt = new Date().toISOString();
      writeJob(job);

      try {
        const result = await checkOne(page, cid);
        const checkedAt = new Date().toISOString();
        pendingBatch.push({
          cid,
          status: result.status,
          url: result.url,
          checkedAt,
        });
        job.pendingCids = job.pendingCids.slice(1);
        job.processedCount += 1;
        job.successCount += 1;
        if (result.status === "available") job.availableCount += 1;
        else job.unavailableCount += 1;
      } catch (error) {
        job.pendingCids = job.pendingCids.slice(1);
        job.processedCount += 1;
        job.failedCount += 1;
        job.lastError =
          error instanceof Error ? error.message : String(error);
        console.error("[fanza-tv-check] fail", cid, job.lastError);
      }

      const elapsedMs = Date.now() - startedMs;
      job.elapsedMs = elapsedMs;
      const rate =
        job.processedCount > 0 ? elapsedMs / job.processedCount : 0;
      job.estimatedRemainingMs =
        rate > 0 ? Math.round(rate * job.pendingCids.length) : null;
      job.message = `判定中 ${job.processedCount}/${job.targetCount}（成功 ${job.successCount} / 失敗 ${job.failedCount}）`;
      job.updatedAt = new Date().toISOString();

      if (
        pendingBatch.length >= BATCH_SIZE ||
        job.pendingCids.length === 0
      ) {
        const batchLen = pendingBatch.length;
        await saveBatch(client, pendingBatch);
        updatedInSession += batchLen;
        job.updatedCount = (job.updatedCount || 0) + batchLen;
        pendingBatch.length = 0;
        writeJob(job);
      } else {
        writeJob(job);
      }

      await sleep(PAUSE_MS);
    }

    if (job.status !== "stopped") {
      if (pendingBatch.length > 0) {
        const batchLen = pendingBatch.length;
        await saveBatch(client, pendingBatch);
        updatedInSession += batchLen;
        job.updatedCount = (job.updatedCount || 0) + batchLen;
        pendingBatch.length = 0;
      }
      job.status = "completed";
      job.currentCid = null;
      job.completedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - startedMs;
      job.estimatedRemainingMs = 0;
      job.message = `完了（成功 ${job.successCount} / 失敗 ${job.failedCount} / 見放題 ${job.availableCount} / 対象外 ${job.unavailableCount}）`;
      job.updatedAt = job.completedAt;
      writeJob(job);
    }

    const remainingUnknown = await countUnknownWorks(client);
    printRunSummary({
      requested,
      fetched,
      processed: job.processedCount,
      updated: job.updatedCount || updatedInSession,
      success: job.successCount,
      failed: job.failedCount,
      available: job.availableCount,
      unavailable: job.unavailableCount,
      remainingUnknown,
      includeHeader: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[fanza-tv-check] fatal", message);
    if (pendingBatch.length > 0) {
      try {
        await saveBatch(client, pendingBatch);
        updatedInSession += pendingBatch.length;
        job.updatedCount = (job.updatedCount || 0) + pendingBatch.length;
      } catch {
        // ignore
      }
    }
    job.status = "failed";
    job.lastError = message;
    job.message = `失敗: ${message}`;
    job.updatedAt = new Date().toISOString();
    job.elapsedMs = Date.now() - startedMs;
    writeJob(job);
    let remainingUnknown = "?";
    try {
      remainingUnknown = await countUnknownWorks(client);
    } catch {
      // ignore
    }
    printRunSummary({
      requested,
      fetched,
      processed: job.processedCount,
      updated: job.updatedCount || updatedInSession,
      success: job.successCount,
      failed: job.failedCount,
      available: job.availableCount,
      unavailable: job.unavailableCount,
      remainingUnknown,
      includeHeader: true,
    });
    process.exitCode = 1;
  } finally {
    try {
      await session?.context?.close();
    } catch {
      // ignore
    }
    try {
      await session?.browser?.close();
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
