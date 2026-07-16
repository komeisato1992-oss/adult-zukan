#!/usr/bin/env node
/**
 * FANZA TV 見放題判定ワーカー（Macローカル・detached）
 *
 * 管理画面 API から spawn される。Cursor / next dev を閉じても継続する。
 *
 *   node scripts/run-fanza-tv-check.mjs
 *   npm run fanza-tv:check -- --limit=100
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

function parseCliLimit() {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return null;
  const raw = arg.slice("--limit=".length);
  if (raw === "all") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function ensureCliJob() {
  const existing = readJob();
  if (existing?.status === "running" || existing?.status === "pending") {
    return existing;
  }
  if (
    existing &&
    (existing.status === "stopped" || existing.status === "failed") &&
    Array.isArray(existing.pendingCids) &&
    existing.pendingCids.length > 0 &&
    !process.argv.includes("--fresh")
  ) {
    return existing;
  }

  // CLI 単独起動: works.fanza_tv_status=unknown を対象
  loadEnvLocal();
  const client = getSupabase();
  await assertWorksSchema(client);
  const limit = parseCliLimit() ?? 100;
  const cids = [];
  let from = 0;
  while (cids.length < limit) {
    const { data, error } = await client
      .from("works")
      .select("cid,fanza_tv_status")
      .eq("fanza_tv_status", "unknown")
      .order("cid", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.cid) cids.push(String(row.cid));
      if (cids.length >= limit) break;
    }
    if (rows.length < 1000) break;
    from += 1000;
  }

  const now = new Date().toISOString();
  const job = {
    jobId: `fanza-tv-cli-${Date.now()}`,
    status: "running",
    mode: "limit",
    limit,
    targetCount: cids.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    availableCount: 0,
    unavailableCount: 0,
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
    message: `CLI 判定開始（${cids.length}件）`,
    lastError: null,
    profilePath: existsSync(PROFILE_DIR) ? PROFILE_DIR : STATE_PATH,
    logPath: null,
  };
  writeJob(job);
  return job;
}

async function main() {
  loadEnvLocal();
  process.chdir(ROOT);

  let job = readJob();
  if (!job || process.argv.includes("--fresh") || process.argv.includes("--limit=")) {
    // API 起動時は既存ジョブを使う。CLI --limit 時は新規
    if (!job || process.argv.includes("--fresh") || (!job.pendingCids?.length && process.argv.includes("--limit="))) {
      job = await ensureCliJob();
    }
  }
  if (!job) {
    console.error("ジョブがありません。管理画面から開始するか --limit=100 を指定してください");
    process.exit(1);
  }

  const client = getSupabase();
  await assertWorksSchema(client);

  job.status = "running";
  job.stopRequested = false;
  job.pid = process.pid;
  job.updatedAt = new Date().toISOString();
  job.message = "Playwright で判定中…";
  writeJob(job);

  const startedMs = Date.parse(job.startedAt) || Date.now();
  let session = null;
  const pendingBatch = [];

  try {
    session = await launchBrowser();
    const { page } = session;

    while (job.pendingCids.length > 0) {
      // 停止フラグをディスクから再読込
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
        await saveBatch(client, pendingBatch);
        pendingBatch.length = 0;
        writeJob(job);
      } else {
        writeJob(job);
      }

      await sleep(PAUSE_MS);
    }

    if (job.status !== "stopped") {
      if (pendingBatch.length > 0) {
        await saveBatch(client, pendingBatch);
      }
      job.status = "completed";
      job.currentCid = null;
      job.completedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - startedMs;
      job.estimatedRemainingMs = 0;
      job.message = `完了（成功 ${job.successCount} / 失敗 ${job.failedCount} / 見放題 ${job.availableCount} / 対象外 ${job.unavailableCount}）`;
      job.updatedAt = job.completedAt;
      writeJob(job);
      console.log("[fanza-tv-check] completed", {
        success: job.successCount,
        failed: job.failedCount,
        available: job.availableCount,
        unavailable: job.unavailableCount,
        elapsedMs: job.elapsedMs,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[fanza-tv-check] fatal", message);
    if (pendingBatch.length > 0) {
      try {
        await saveBatch(client, pendingBatch);
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
