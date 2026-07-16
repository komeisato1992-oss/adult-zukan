#!/usr/bin/env node
/**
 * FANZA TV 用 Playwright プロファイル（storageState）を保存する。
 *
 * 用法:
 *   npm run fanza-tv:save-profile
 *
 * ブラウザが開くので、年齢確認・ログインを済ませたあとターミナルで Enter。
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".playwright");
const STATE_PATH = path.join(OUT_DIR, "fanza-tv-storage-state.json");
const START_URL = "https://tv.dmm.co.jp/list/?viewing_plans=FANZA_TV";

function waitEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: "domcontentloaded" });

  console.log("ブラウザで年齢確認・ログインを完了してください。");
  console.log(`保存先: ${path.relative(ROOT, STATE_PATH)}`);
  await waitEnter("完了したら Enter を押してください… ");

  await context.storageState({ path: STATE_PATH });
  await browser.close();

  if (!existsSync(STATE_PATH)) {
    console.error("storageState の保存に失敗しました");
    process.exit(1);
  }
  console.log("保存しました:", path.relative(ROOT, STATE_PATH));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
