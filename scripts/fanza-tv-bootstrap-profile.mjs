#!/usr/bin/env node
/**
 * 年齢確認クッキーを含む storageState を自動作成（非対話）。
 * ログインが必要な場合は npm run fanza-tv:save-profile を使う。
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".playwright");
const STATE_PATH = path.join(OUT_DIR, "fanza-tv-storage-state.json");
const START_URL = "https://tv.dmm.co.jp/list/?viewing_plans=FANZA_TV";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "ja-JP",
  });
  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  // 年齢確認ボタンがあればクリック
  const candidates = [
    'button:has-text("はい")',
    'a:has-text("はい")',
    'button:has-text("入場")',
    'a:has-text("入場する")',
    'input[value="はい"]',
    'text=はい',
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(1000);
        break;
      } catch {
        // next
      }
    }
  }

  await context.addCookies([
    {
      name: "age_check_done",
      value: "1",
      domain: ".dmm.co.jp",
      path: "/",
    },
    {
      name: "age_check_done",
      value: "1",
      domain: ".dmm.com",
      path: "/",
    },
  ]);

  await context.storageState({ path: STATE_PATH });
  await browser.close();
  console.log("saved", path.relative(ROOT, STATE_PATH));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
