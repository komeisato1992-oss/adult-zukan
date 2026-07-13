#!/usr/bin/env node
/**
 * 軽量同期の前後検証ヘルパー
 *
 *   node scripts/doujin-light-sync-audit.mjs snapshot
 *   node scripts/doujin-light-sync-audit.mjs compare
 *   node scripts/doujin-light-sync-audit.mjs changes --before=... --after=...
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const worksPath = resolve(root, "data/doujin/works.json");
const rawDir = resolve(root, "data/doujin/works-raw");
const backupDir = resolve(root, "data/backups");

const PROTECTED_FIELDS = [
  "title",
  "description",
  "authorComment",
  "imageSmallUrl",
  "imageListUrl",
  "imageLargeUrl",
  "sampleImageUrls",
  "circleIds",
  "authorIds",
  "seriesId",
  "genreIds",
  "productFormat",
  "productFormatNormalized",
  "releaseDate",
  "affiliateUrl",
  "productUrl",
];

const LIGHT_FIELDS = [
  "price",
  "originalPrice",
  "discountRate",
  "isSale",
  "saleEndAt",
  "rating",
  "reviewCount",
  "currentPopularRank",
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function loadWorks() {
  return JSON.parse(readFileSync(worksPath, "utf8"));
}

function pickProtected(work) {
  const out = {};
  for (const key of PROTECTED_FIELDS) {
    out[key] = work[key] ?? null;
  }
  return out;
}

function pickLight(work) {
  const out = {};
  for (const key of LIGHT_FIELDS) {
    out[key] = work[key] ?? null;
  }
  return out;
}

function rawMeta() {
  if (!existsSync(rawDir)) {
    return { shardCount: 0, shards: [] };
  }
  const files = readdirSync(rawDir).filter((f) => f.endsWith(".json"));
  const shards = files.map((name) => {
    const st = statSync(resolve(rawDir, name));
    return {
      name,
      size: st.size,
      mtimeMs: st.mtimeMs,
      mtime: st.mtime.toISOString(),
    };
  });
  return { shardCount: shards.length, shards };
}

function cmdSnapshot() {
  if (!existsSync(worksPath)) {
    console.error("works.json not found");
    process.exit(1);
  }
  mkdirSync(backupDir, { recursive: true });
  const ts = stamp();
  const backupPath = resolve(
    backupDir,
    `doujin-works-before-light-sync-${ts}.json`,
  );
  const protectedPath = resolve(
    backupDir,
    `doujin-light-sync-protected-fields-before.json`,
  );
  const lightPath = resolve(
    backupDir,
    `doujin-light-sync-light-fields-before.json`,
  );
  const rawMetaPath = resolve(
    backupDir,
    `doujin-raw-shards-meta-before-light-sync-${ts}.json`,
  );

  copyFileSync(worksPath, backupPath);
  const works = loadWorks();
  const protectedMap = {};
  const lightMap = {};
  for (const work of works) {
    protectedMap[work.id] = pickProtected(work);
    lightMap[work.id] = pickLight(work);
  }
  writeFileSync(protectedPath, JSON.stringify(protectedMap));
  writeFileSync(lightPath, JSON.stringify(lightMap));
  const meta = rawMeta();
  writeFileSync(rawMetaPath, JSON.stringify(meta, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupPath,
        protectedPath,
        lightPath,
        rawMetaPath,
        workCount: works.length,
        rawShardCount: meta.shardCount,
      },
      null,
      2,
    ),
  );
}

function cmdCompare() {
  const protectedPath = resolve(
    backupDir,
    "doujin-light-sync-protected-fields-before.json",
  );
  if (!existsSync(protectedPath)) {
    console.error("missing protected snapshot; run snapshot first");
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(protectedPath, "utf8"));
  const works = loadWorks();
  const counts = Object.fromEntries(PROTECTED_FIELDS.map((k) => [k, 0]));
  const samples = [];
  for (const work of works) {
    const prev = before[work.id];
    if (!prev) continue;
    const next = pickProtected(work);
    for (const key of PROTECTED_FIELDS) {
      const a = JSON.stringify(prev[key] ?? null);
      const b = JSON.stringify(next[key] ?? null);
      if (a !== b) {
        counts[key] += 1;
        if (samples.length < 10) {
          samples.push({ id: work.id, field: key });
        }
      }
    }
  }

  const lightBeforePath = resolve(
    backupDir,
    "doujin-light-sync-light-fields-before.json",
  );
  const lightChanges = [];
  if (existsSync(lightBeforePath)) {
    const lightBefore = JSON.parse(readFileSync(lightBeforePath, "utf8"));
    for (const work of works) {
      const prev = lightBefore[work.id];
      if (!prev) continue;
      const next = pickLight(work);
      const changed = {};
      let any = false;
      for (const key of LIGHT_FIELDS) {
        if (JSON.stringify(prev[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
          changed[key] = { before: prev[key] ?? null, after: next[key] ?? null };
          any = true;
        }
      }
      if (any) {
        lightChanges.push({
          id: work.id,
          priceBefore: prev.price,
          priceAfter: next.price,
          originalPriceBefore: prev.originalPrice,
          originalPriceAfter: next.originalPrice,
          discountRateBefore: prev.discountRate,
          discountRateAfter: next.discountRate,
          isSaleBefore: prev.isSale,
          isSaleAfter: next.isSale,
          ratingBefore: prev.rating,
          ratingAfter: next.rating,
          reviewCountBefore: prev.reviewCount,
          reviewCountAfter: next.reviewCount,
          rankBefore: prev.currentPopularRank,
          rankAfter: next.currentPopularRank,
          fields: Object.keys(changed),
        });
      }
    }
  }

  const rawNow = rawMeta();
  const rawMetaFiles = readdirSync(backupDir).filter((f) =>
    f.startsWith("doujin-raw-shards-meta-before-light-sync-"),
  );
  let rawDiff = { shardCountBefore: null, shardCountAfter: rawNow.shardCount, mtimeChanged: 0 };
  if (rawMetaFiles.length > 0) {
    rawMetaFiles.sort();
    const beforeMeta = JSON.parse(
      readFileSync(resolve(backupDir, rawMetaFiles[rawMetaFiles.length - 1]), "utf8"),
    );
    const beforeMap = new Map(beforeMeta.shards.map((s) => [s.name, s]));
    let mtimeChanged = 0;
    for (const s of rawNow.shards) {
      const b = beforeMap.get(s.name);
      if (!b || b.mtimeMs !== s.mtimeMs || b.size !== s.size) mtimeChanged += 1;
    }
    rawDiff = {
      shardCountBefore: beforeMeta.shardCount,
      shardCountAfter: rawNow.shardCount,
      mtimeChanged,
    };
  }

  const shown = lightChanges.slice(0, 50);
  console.log(
    JSON.stringify(
      {
        protectedFieldChangeCounts: counts,
        protectedTotalChanges: Object.values(counts).reduce((a, b) => a + b, 0),
        protectedSamples: samples,
        lightChangedCount: lightChanges.length,
        lightChangedShown: shown.length,
        lightChanges: shown,
        rawDiff,
        ok: Object.values(counts).every((n) => n === 0) && rawDiff.mtimeChanged === 0,
      },
      null,
      2,
    ),
  );
}

function hashFile(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function cmdHash() {
  console.log(
    JSON.stringify(
      {
        worksSha256: existsSync(worksPath) ? hashFile(worksPath) : null,
        worksSize: existsSync(worksPath) ? statSync(worksPath).size : null,
        raw: rawMeta(),
      },
      null,
      2,
    ),
  );
}

const cmd = process.argv[2] || "snapshot";
if (cmd === "snapshot") cmdSnapshot();
else if (cmd === "compare") cmdCompare();
else if (cmd === "hash") cmdHash();
else {
  console.error("usage: snapshot | compare | hash");
  process.exit(1);
}
