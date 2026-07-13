#!/usr/bin/env node
/**
 * Phase 1: Vercel CPU/ISR 削減前のベースライン計測。
 * 秘密情報・raw全文は出力しない。
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const worksPath = path.join(root, "data/doujin/works.json");
const outDir = path.join(root, "data/backups");
const outPath = path.join(outDir, "vercel-cost-baseline.json");

function mb(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(3));
}

function timeMs(fn) {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

function countAdultWorks() {
  const dir = path.join(root, "data/dmm/catalog");
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const data = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
    total += Array.isArray(data) ? data.length : 0;
  }
  return total;
}

function collectRevalidateSettings() {
  const appDir = path.join(root, "app");
  const hits = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
      const text = readFileSync(full, "utf8");
      const rev = text.match(/export const revalidate\s*=\s*(\d+)/);
      const dyn = text.match(/export const dynamic\s*=\s*["']([^"']+)["']/);
      if (rev || dyn) {
        hits.push({
          file: path.relative(root, full),
          revalidate: rev ? Number(rev[1]) : null,
          dynamic: dyn ? dyn[1] : null,
        });
      }
    }
  }
  walk(appDir);
  return hits;
}

const adultWorks = countAdultWorks();
const worksStat = existsSync(worksPath) ? statSync(worksPath) : null;

const readTimed = timeMs(() =>
  existsSync(worksPath) ? readFileSync(worksPath, "utf8") : "[]",
);
const parseTimed = timeMs(() => JSON.parse(readTimed.value));
const works = Array.isArray(parseTimed.value) ? parseTimed.value : [];

let rawCount = 0;
let rawBytes = 0;
const ids = new Set();
let duplicateIds = 0;
for (const work of works) {
  if (ids.has(work.id)) duplicateIds += 1;
  else ids.add(work.id);
  if (work.rawApiResponse != null) {
    rawCount += 1;
    rawBytes += Buffer.byteLength(JSON.stringify(work.rawApiResponse), "utf8");
  }
}

const lightWorks = works.map((work) => {
  const { rawApiResponse: _raw, ...rest } = work;
  return rest;
});
const stringifyLight = timeMs(() => JSON.stringify(lightWorks));
const stringifyPretty = timeMs(() => JSON.stringify(works, null, 2));
const stringifyCompact = timeMs(() => JSON.stringify(works));

const writeTimed = timeMs(() => {
  // 実ファイルは書き換えない（計測のみ）
  return Buffer.byteLength(stringifyCompact.value, "utf8");
});

const pageSettings = collectRevalidateSettings();

const baseline = {
  measuredAt: new Date().toISOString(),
  adultWorks,
  doujinWorks: works.length,
  worksJsonBytes: worksStat?.size ?? 0,
  worksJsonMb: worksStat ? mb(worksStat.size) : 0,
  rawApiResponseCount: rawCount,
  rawBytesEstimate: rawBytes,
  rawMbEstimate: mb(rawBytes),
  lightJsonBytesEstimate: Buffer.byteLength(stringifyLight.value, "utf8"),
  lightJsonMbEstimate: mb(Buffer.byteLength(stringifyLight.value, "utf8")),
  duplicateIds,
  timingsMs: {
    readFile: Number(readTimed.ms.toFixed(1)),
    parse: Number(parseTimed.ms.toFixed(1)),
    stringifyPretty: Number(stringifyPretty.ms.toFixed(1)),
    stringifyCompact: Number(stringifyCompact.ms.toFixed(1)),
    stringifyLight: Number(stringifyLight.ms.toFixed(1)),
    saveSimulated: Number(writeTimed.ms.toFixed(1)),
  },
  importIoBaseline: {
    note: "現行実装は1バッチごとに load+save。500件/バッチ100なら約5回ずつ。",
    readsPer500ItemsApprox: 5,
    writesPer500ItemsApprox: 5,
    apiFetchPerBatch: 100,
  },
  publicPageReadsPerRequest: {
    note: "catalog getCatalogContext は React.cache で1リクエスト1回だが、リクエストごとにファイル読込・parse。",
    loadDoujinWorksPerRequest: 1,
  },
  pageSettings,
  contentFingerprint: createHash("sha1")
    .update(String(works.length))
    .update(String(worksStat?.size ?? 0))
    .digest("hex")
    .slice(0, 12),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

console.log("=== Vercel cost baseline ===");
console.log(JSON.stringify(baseline, null, 2));
console.log(`\nWrote ${path.relative(root, outPath)}`);
