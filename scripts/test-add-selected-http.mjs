#!/usr/bin/env node
/**
 * add-selected-works HTTP 段階的検証
 * 使い方: node scripts/test-add-selected-http.mjs --count 1
 * 前提: npm run dev が起動済み、.env.local に設定あり
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

function adminCookie() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("ADMIN_PASSWORD が .env.local にありません");
  }
  const value = createHash("sha256")
    .update(`admin-session:${password}`)
    .digest("hex");
  return `adult_zukan_admin_session=${value}`;
}

function parseArgs() {
  const args = {
    counts: [1],
    offset: 6000,
    baseUrl: process.env.TEST_BASE_URL ?? "http://localhost:3000",
  };

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--count" && process.argv[i + 1]) {
      args.counts = [Number(process.argv[++i])];
    } else if (arg === "--counts" && process.argv[i + 1]) {
      args.counts = process.argv[++i].split(",").map((v) => Number(v.trim()));
    } else if (arg === "--offset" && process.argv[i + 1]) {
      args.offset = Number(process.argv[++i]);
    } else if (arg === "--base-url" && process.argv[i + 1]) {
      args.baseUrl = process.argv[++i];
    }
  }

  return args;
}

async function postJson(url, body, cookie) {
  const startedAt = Date.now();
  const text = JSON.stringify(body);
  const payloadBytes = Buffer.byteLength(text, "utf8");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: text,
  });

  const responseText = await response.text();
  let parsed = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    // keep raw
  }

  return {
    status: response.status,
    statusText: response.statusText,
    responseText,
    parsed,
    payloadBytes,
    elapsedMs: Date.now() - startedAt,
  };
}

function slimWorkItem(item) {
  return {
    content_id: item.content_id,
    product_id: item.product_id,
    title: item.title,
    URL: item.URL,
    affiliateURL: item.affiliateURL,
    imageURL: item.imageURL,
    prices: item.prices,
    iteminfo: item.iteminfo,
    date: item.date,
    volume: item.volume,
    description: item.description,
    maker: item.maker,
    label: item.label,
    series: item.series,
    review: item.review,
    sourcePopularityRank: item.sourcePopularityRank,
    popularityUpdatedAt: item.popularityUpdatedAt,
    addedAt: item.addedAt,
  };
}

async function fetchCandidates(baseUrl, cookie, offset, requestedCount) {
  return postJson(
    `${baseUrl}/api/admin/import/fetch-candidates`,
    {
      sort: "popular",
      offset,
      requestedCount,
    },
    cookie,
  );
}

async function addSelected(baseUrl, cookie, candidates) {
  const works = candidates.map((candidate) => ({
    contentId:
      candidate.contentId ??
      candidate.item?.content_id ??
      candidate.item?.product_id,
    item: slimWorkItem(candidate.item),
    sourcePopularityRank:
      candidate.candidateMeta?.absolutePopularityPosition ??
      candidate.rankPosition ??
      null,
  }));

  return postJson(
    `${baseUrl}/api/admin/import/add-selected-works`,
    { works },
    cookie,
  );
}

async function main() {
  const args = parseArgs();
  const cookie = adminCookie();
  const results = [];

  for (const count of args.counts) {
    console.log(`\n========== count=${count}, offset=${args.offset} ==========`);

    const fetchStarted = Date.now();
    const fetchRes = await fetchCandidates(
      args.baseUrl,
      cookie,
      args.offset,
      Math.max(count * 2, 50),
    );

    console.log("[test] fetch-candidates", {
      status: fetchRes.status,
      elapsedMs: fetchRes.elapsedMs,
      bodyPreview: fetchRes.responseText.slice(0, 300),
    });

    if (!fetchRes.parsed?.candidates) {
      console.error("[test] fetch failed", fetchRes.responseText.slice(0, 1000));
      results.push({ count, ok: false, step: "fetch-candidates" });
      break;
    }

    const candidates = fetchRes.parsed.candidates.slice(0, count);
    if (candidates.length < count) {
      console.error("[test] not enough candidates", {
        need: count,
        got: candidates.length,
      });
      results.push({ count, ok: false, step: "candidate-shortage" });
      break;
    }

    const addRes = await addSelected(args.baseUrl, cookie, candidates);

    console.log("[test] add-selected-works", {
      status: addRes.status,
      payloadBytes: addRes.payloadBytes,
      payloadKb: (addRes.payloadBytes / 1024).toFixed(1),
      elapsedMs: addRes.elapsedMs,
      elapsedSec: (addRes.elapsedMs / 1000).toFixed(1),
      phase: addRes.parsed?.phase,
      message: addRes.parsed?.message ?? addRes.parsed?.error,
      details: addRes.parsed?.details,
      success: addRes.parsed?.success,
      addedCount: addRes.parsed?.summary?.addedCount,
    });

    if (!addRes.parsed) {
      console.log("[test] raw body", addRes.responseText.slice(0, 2000));
    }

    const ok = addRes.status >= 200 && addRes.status < 300 && addRes.parsed?.success !== false;
    results.push({
      count,
      ok,
      status: addRes.status,
      phase: addRes.parsed?.phase,
      message: addRes.parsed?.message,
      payloadBytes: addRes.payloadBytes,
      elapsedMs: addRes.elapsedMs,
      addedCount: addRes.parsed?.summary?.addedCount,
      details: addRes.parsed?.details,
    });

    if (!ok) break;
  }

  console.log("\n========== summary ==========");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
