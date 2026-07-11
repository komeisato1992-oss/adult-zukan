#!/usr/bin/env node
/**
 * FANZA 同期機能の静的検証
 * 実行: node scripts/test-fanza-sync.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const FANZA_NOT_FOUND_HIDE_THRESHOLD = 3;
const FANZA_UNAVAILABLE_HIDE_AFTER_MS = 24 * 60 * 60 * 1000;

function getConsecutiveNotFoundCount(work) {
  return work.consecutiveNotFoundCount ?? work.consecutiveFetchFailures ?? 0;
}

function simulateNotFound(existing, now = Date.now()) {
  const iso = new Date(now).toISOString();
  const count = getConsecutiveNotFoundCount(existing) + 1;
  const detectedAt = existing.unavailableDetectedAt ?? iso;
  const elapsed = now - Date.parse(detectedAt);
  const shouldHide =
    count >= FANZA_NOT_FOUND_HIDE_THRESHOLD &&
    elapsed >= FANZA_UNAVAILABLE_HIDE_AFTER_MS;

  return {
    consecutiveNotFoundCount: count,
    unavailableDetectedAt: detectedAt,
    isActive: shouldHide ? false : true,
    availabilityStatus: shouldHide ? "unavailable" : "temporarily_unconfirmed",
    hiddenReason: shouldHide ? "fanza_unavailable" : existing.hiddenReason,
  };
}

const baseWork = { content_id: "abc123", title: "Test Work" };

assert.equal(simulateNotFound(baseWork).isActive, true);
assert.equal(simulateNotFound(baseWork).availabilityStatus, "temporarily_unconfirmed");
assert.equal(simulateNotFound(baseWork).consecutiveNotFoundCount, 1);

let work = baseWork;
for (let i = 0; i < 2; i += 1) {
  work = { ...work, ...simulateNotFound(work) };
}
assert.equal(work.isActive, true, "2回 not found では非表示にしない");

work = {
  ...work,
  ...simulateNotFound(work, Date.parse(work.unavailableDetectedAt) + FANZA_UNAVAILABLE_HIDE_AFTER_MS + 1000),
};
assert.equal(work.isActive, false, "3回 not found + 24h で非表示");
assert.equal(work.hiddenReason, "fanza_unavailable");

const productSource = read("lib/dmm/fanza-sync-product.ts");
assert.match(productSource, /FanzaProductNotFoundError/);
assert.match(productSource, /FanzaApiTransportError/);
assert.match(productSource, /consecutiveNotFoundCount: 0/);
assert.doesNotMatch(productSource, /markTransportError[\s\S]*consecutiveNotFoundCount \+ 1/);

const runnerSource = read("lib/admin/fanza-sync-runner.ts");
assert.match(runnerSource, /selectFanzaSyncBatch/);
assert.match(runnerSource, /FANZA_SYNC_DEFAULT_CONCURRENCY/);
assert.doesNotMatch(runnerSource, /processFanzaSyncBatch[\s\S]*items\.length/);

const startRoute = read("app/api/admin/fanza-sync/start/route.ts");
assert.match(startRoute, /startFanzaSyncJob/);
assert.doesNotMatch(startRoute, /processFanzaSyncBatch/);

const processRoute = read("app/api/admin/fanza-sync/process/route.ts");
assert.match(processRoute, /maxDuration = 300/);
assert.match(processRoute, /processFanzaSyncBatch/);

const cronRoute = read("app/api/cron/fanza-sync/route.ts");
assert.match(cronRoute, /CRON_SECRET/);
assert.match(cronRoute, /runFanzaSyncUntilDeadline/);

const vercel = read("vercel.json");
assert.match(vercel, /"schedule": "0 20 \* \* \*"/);
assert.match(vercel, /\/api\/cron\/fanza-sync/);

const staticWorks = read("lib/dmm/static-works.ts");
assert.match(staticWorks, /filterPublicCatalogWorks/);

const worksPage = read("app/works/[slug]/page.tsx");
assert.match(worksPage, /UnavailableWorkDetailView/);
assert.match(worksPage, /noIndex: true/);

const panel = read("components/admin/FanzaSyncPanel.tsx");
assert.match(panel, /掲載作品を最新に更新/);
assert.match(panel, /同期履歴/);

console.log("test-fanza-sync: all checks passed");
