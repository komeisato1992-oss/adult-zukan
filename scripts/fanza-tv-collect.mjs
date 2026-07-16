#!/usr/bin/env node
/**
 * FANZA TV 一覧から見放題対象 CID を画面操作のみで収集する（ローカル専用）
 *
 * 用法:
 *   npm run fanza-tv:collect
 *
 * - GraphQL をスクリプトから直接呼ばない
 * - 画面に表示された作品（CID / タイトル / 作品URL）だけ保存
 * - 途中経過を JSON へ保存し、再実行で再開可能
 * - Cookie / storageState / 作品一覧の中身はコンソールへ出さない
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, ".playwright", "fanza-tv-storage-state.json");
const OUT_DIR = path.join(ROOT, "reports", "fanza-tv-collect");
const PROGRESS_PATH = path.join(OUT_DIR, "progress.json");
const RESULT_PATH = path.join(OUT_DIR, "result.json");

const LIST_URL = "https://tv.dmm.co.jp/list/?viewing_plans=FANZA_TV";
const TARGET = 2294;
const IDLE_LIMIT = 25;
const MAX_ROUNDS = 8000;
const PAUSE_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProgress() {
  if (!existsSync(PROGRESS_PATH)) {
    return {
      version: 1,
      target: TARGET,
      itemsByCid: {},
      duplicateHits: 0,
      missingCidHits: 0,
      scrollCount: 0,
      startedAt: null,
      updatedAt: null,
      stopReason: null,
    };
  }
  return JSON.parse(readFileSync(PROGRESS_PATH, "utf8"));
}

function saveProgress(state) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(PROGRESS_PATH, JSON.stringify(state, null, 2), "utf8");
}

function printCount(n) {
  process.stdout.write(`\r${n}／${TARGET}`);
}

/**
 * @param {import('playwright').Page} page
 */
async function harvestDisplayed(page) {
  return page.evaluate(() => {
    /** @type {Array<{cid:string,title:string,workUrl:string}>} */
    const rows = [];

    const push = (cid, title, workUrl) => {
      rows.push({
        cid: (cid || "").trim(),
        title: (title || "").replace(/\s+/g, " ").trim().slice(0, 300),
        workUrl: (workUrl || "").trim(),
      });
    };

    // メイン一覧（カルーセル除外）
    const packs = Array.from(
      document.querySelectorAll('[data-testid="itemPackage"]'),
    ).filter((el) => !el.closest("#carousel-list, [class*='carousel']"));

    for (const pack of packs) {
      const a =
        pack.querySelector('a[href*="content="]') ||
        pack.querySelector("a[href]");
      if (!a) {
        push("", "", "");
        continue;
      }
      let cid = "";
      let workUrl = a.href || "";
      try {
        const u = new URL(a.href, location.origin);
        workUrl = u.href;
        cid = u.searchParams.get("content") || "";
      } catch {
        // ignore
      }
      const title =
        a.getAttribute("aria-label") ||
        pack.querySelector("img")?.getAttribute("alt") ||
        pack.querySelector("h1,h2,h3,span.font-normal,span")?.textContent ||
        "";
      push(cid, title, workUrl);
    }

    // FANZA_TV の content リンク（表示中のもの）
    for (const a of document.querySelectorAll(
      'a[href*="viewing_plans=FANZA_TV"][href*="content="]',
    )) {
      if (a.closest("#carousel-list, [class*='carousel']")) continue;
      try {
        const u = new URL(a.href, location.origin);
        if (u.searchParams.get("viewing_plans") !== "FANZA_TV") continue;
        const cid = u.searchParams.get("content") || "";
        const title =
          a.getAttribute("aria-label") ||
          a.querySelector("img")?.getAttribute("alt") ||
          a.textContent ||
          "";
        push(cid, title, u.href);
      } catch {
        // ignore
      }
    }

    return rows;
  });
}

/**
 * @param {ReturnType<typeof loadProgress>} state
 * @param {Array<{cid:string,title:string,workUrl:string}>} batch
 */
function mergeBatch(state, batch) {
  let gained = 0;
  for (const row of batch) {
    if (!row.cid) {
      state.missingCidHits += 1;
      continue;
    }
    if (state.itemsByCid[row.cid]) {
      state.duplicateHits += 1;
      continue;
    }
    state.itemsByCid[row.cid] = {
      cid: row.cid,
      title: row.title || "",
      workUrl: row.workUrl || "",
    };
    gained += 1;
  }
  return gained;
}

/**
 * 画面操作: 下へスクロールし、同一ページ内の読み込み促進だけ行う
 * （別サービスへ遷移する「もっと見る」リンクは踏まない）
 * @param {import('playwright').Page} page
 */
async function advanceUi(page) {
  await page.evaluate(() => {
    window.scrollBy(0, Math.floor(window.innerHeight * 0.85));
  });
  await sleep(200);

  // メイン一覧末尾の作品を視界へ
  await page.evaluate(() => {
    const packs = Array.from(
      document.querySelectorAll('[data-testid="itemPackage"]'),
    ).filter((el) => !el.closest("#carousel-list, [class*='carousel']"));
    packs[packs.length - 1]?.scrollIntoView({ block: "end" });
  });

  await page.mouse.wheel(0, 1200);
  await sleep(200);

  // 同一一覧に留まるロード系コントロールがあればクリック
  await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll("button, a, [role='button']"),
    ).filter((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /もっと見る|さらに表示|次へ|もっと読/.test(t);
    });
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.left < 250) continue; // サイドバー除外
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        // FANZA_TV 一覧以外へ飛ぶリンクは除外
        if (href && !/viewing_plans=FANZA_TV(?!_PLUS)/.test(href)) continue;
        if (/FANZA_TV_PLUS|video\.dmm\.co\.jp/.test(href)) continue;
      }
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      break;
    }
  });
}

async function main() {
  if (!existsSync(STATE_PATH)) {
    console.error("storageState がありません。先に年齢確認状態を保存してください。");
    console.error(`期待パス: ${path.relative(ROOT, STATE_PATH)}`);
    process.exit(1);
  }

  const state = loadProgress();
  if (!state.startedAt) state.startedAt = new Date().toISOString();
  const t0 = Date.now();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error("Chromium の起動に失敗しました。 npx playwright install chromium");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  /** @type {{hasNextPage: boolean|null, seen: boolean}} */
  let pageInfo = { hasNextPage: null, seen: false };
  let gqlSeenThisRound = false;

  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  // 画面操作に伴う GraphQL を監視するだけ（直接呼び出しはしない）
  page.on("response", async (response) => {
    try {
      if (!response.url().includes("api.tv.dmm.co.jp/graphql")) return;
      if (response.request().method() === "OPTIONS") return;
      const post = response.request().postData() || "";
      if (!post.includes("FetchFanzaTvPlusSearch")) return;
      const plan = post.match(/"viewingPlan"\s*:\s*"([^"]+)"/)?.[1];
      if (plan !== "FANZA_TV") return;
      if (response.status() !== 200) return;
      gqlSeenThisRound = true;
      const json = JSON.parse(await response.text());
      const walk = (node, depth = 0) => {
        if (!node || depth > 14) return;
        if (Array.isArray(node)) {
          for (const x of node) walk(x, depth + 1);
          return;
        }
        if (typeof node !== "object") return;
        if (
          node.pageInfo &&
          typeof node.pageInfo.hasNextPage === "boolean"
        ) {
          pageInfo = {
            hasNextPage: node.pageInfo.hasNextPage,
            seen: true,
          };
        }
        for (const v of Object.values(node)) walk(v, depth + 1);
      };
      walk(json);
    } catch {
      // ignore
    }
  });

  let stopReason = "unknown";
  let idle = 0;

  try {
    await page.goto(LIST_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await sleep(3500);
    if (/age_check/i.test(page.url())) {
      throw new Error("age_check");
    }

    mergeBatch(state, await harvestDisplayed(page));
    printCount(Object.keys(state.itemsByCid).length);
    saveProgress(state);

    while (state.scrollCount < MAX_ROUNDS) {
      const count = Object.keys(state.itemsByCid).length;
      if (count >= TARGET) {
        stopReason = "reached_target";
        break;
      }
      if (pageInfo.seen && pageInfo.hasNextPage === false) {
        stopReason = "hasNextPage_false";
        break;
      }

      const before = count;
      gqlSeenThisRound = false;
      state.scrollCount += 1;

      await advanceUi(page);
      await Promise.race([
        page
          .waitForResponse(
            (r) => {
              if (!r.url().includes("api.tv.dmm.co.jp/graphql")) return false;
              const post = r.request().postData() || "";
              const plan = post.match(/"viewingPlan"\s*:\s*"([^"]+)"/)?.[1];
              return (
                post.includes("FetchFanzaTvPlusSearch") && plan === "FANZA_TV"
              );
            },
            { timeout: 3500 },
          )
          .catch(() => null),
        sleep(PAUSE_MS),
      ]);
      await sleep(400);

      const gained = mergeBatch(state, await harvestDisplayed(page));
      printCount(Object.keys(state.itemsByCid).length);

      if (gained === 0 && !gqlSeenThisRound) idle += 1;
      else idle = 0;

      if (state.scrollCount % 5 === 0) saveProgress(state);

      if (pageInfo.seen && pageInfo.hasNextPage === false) {
        stopReason = "hasNextPage_false";
        break;
      }
      if (idle >= IDLE_LIMIT) {
        stopReason = "no_more_loads";
        break;
      }
    }

    if (stopReason === "unknown" && state.scrollCount >= MAX_ROUNDS) {
      stopReason = "max_rounds";
    }
  } catch (error) {
    stopReason = error instanceof Error ? error.message : String(error);
  } finally {
    await browser.close().catch(() => undefined);
  }

  const items = Object.values(state.itemsByCid);
  const uniqueCidCount = items.length;
  const elapsedMs = Date.now() - t0;
  state.stopReason = stopReason;
  saveProgress(state);

  const summary = {
    uniqueCidCount,
    duplicateHits: state.duplicateHits,
    missingCidCount: state.missingCidHits,
    scrollCount: state.scrollCount,
    elapsedMs,
    elapsedSec: Math.round(elapsedMs / 1000),
    stopReason,
    target: TARGET,
    diffFromTarget: uniqueCidCount - TARGET,
    progressPath: path.relative(ROOT, PROGRESS_PATH),
    resultPath: path.relative(ROOT, RESULT_PATH),
    finishedAt: new Date().toISOString(),
  };

  writeFileSync(
    RESULT_PATH,
    JSON.stringify({ summary, items }, null, 2),
    "utf8",
  );

  process.stdout.write("\n");
  console.log(
    [
      `取得件数: ${summary.uniqueCidCount}`,
      `重複数: ${summary.duplicateHits}`,
      `CID欠落数: ${summary.missingCidCount}`,
      `実行時間: ${summary.elapsedSec}秒`,
      `停止理由: ${summary.stopReason}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
