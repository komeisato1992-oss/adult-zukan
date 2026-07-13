#!/usr/bin/env node
/**
 * アダルトカタログから sampleImageURL / sampleMovieURL を分離する。
 *
 * npm run adult:raw:dry-run
 * npm run adult:raw:split
 * npm run adult:raw:verify
 * npm run adult:catalog:format
 *
 * 注: アダルト側に rawApiResponse は無い。重量メディアフィールドを分離する。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const catalogDir = path.join(root, "data/dmm/catalog");
const mediaDir = path.join(root, "data/dmm/catalog-media");
const backupRoot = path.join(root, "data/backups");
const mode = process.argv[2] || "dry-run";

function mb(n) {
  return Number((n / 1024 / 1024).toFixed(3));
}

function shardKey(contentId) {
  const id = String(contentId || "").trim().toLowerCase();
  if (!id) return "_";
  return createHash("sha1").update(id).digest("hex").slice(0, 2);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function listShardFiles() {
  return readdirSync(catalogDir)
    .filter((f) => /^catalog-\d+\.json$/.test(f))
    .sort();
}

function analyze() {
  const files = listShardFiles();
  let works = 0;
  let withMedia = 0;
  let mediaBytes = 0;
  let catalogBytes = 0;
  let missingId = 0;
  const ids = new Set();
  let duplicateIds = 0;
  const mediaByShard = new Map();

  for (const file of files) {
    const full = path.join(catalogDir, file);
    const text = readFileSync(full, "utf8");
    catalogBytes += Buffer.byteLength(text);
    const list = JSON.parse(text);
    if (!Array.isArray(list)) throw new Error(`${file} is not array`);
    for (const work of list) {
      works += 1;
      const id = work?.content_id;
      if (!id) {
        missingId += 1;
        continue;
      }
      if (ids.has(id)) duplicateIds += 1;
      else ids.add(id);
      if (work.sampleImageURL || work.sampleMovieURL) {
        withMedia += 1;
        const entry = {
          content_id: id,
          sampleImageURL: work.sampleImageURL,
          sampleMovieURL: work.sampleMovieURL,
          updatedAt: work.updatedAt ?? work.lastRefreshedAt,
        };
        const bytes = Buffer.byteLength(JSON.stringify(entry));
        mediaBytes += bytes;
        const key = shardKey(id);
        const bucket = mediaByShard.get(key) ?? [];
        bucket.push(entry);
        mediaByShard.set(key, bucket);
      }
    }
  }

  const displayEstimate = catalogBytes - mediaBytes;
  return {
    shardCount: files.length,
    works,
    withMedia,
    missingId,
    duplicateIds,
    catalogMb: mb(catalogBytes),
    mediaEstimateMb: mb(mediaBytes),
    displayEstimateMb: mb(Math.max(0, displayEstimate)),
    mediaShardCount: mediaByShard.size,
    mediaByShard,
  };
}

function backupCatalog() {
  const dir = path.join(backupRoot, `adult-catalog-before-raw-split-${stamp()}`);
  mkdirSync(dir, { recursive: true });
  const files = listShardFiles();
  for (const file of files) {
    copyFileSync(path.join(catalogDir, file), path.join(dir, file));
  }
  if (existsSync(path.join(catalogDir, "manifest.json"))) {
    copyFileSync(
      path.join(catalogDir, "manifest.json"),
      path.join(dir, "manifest.json"),
    );
  }
  return dir;
}

function writeAtomic(filePath, text) {
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, filePath);
}

function runSplit() {
  const backupDir = backupCatalog();
  const stats = analyze();
  mkdirSync(mediaDir, { recursive: true });

  for (const [key, entries] of stats.mediaByShard) {
    const shardPath = path.join(mediaDir, `${key}.json`);
    const existing = existsSync(shardPath)
      ? JSON.parse(readFileSync(shardPath, "utf8"))
      : { version: 1, updatedAt: "", entries: {} };
    const map = { ...(existing.entries || {}) };
    for (const entry of entries) map[entry.content_id] = entry;
    writeAtomic(
      shardPath,
      `${JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: map,
      })}\n`,
    );
  }

  for (const file of listShardFiles()) {
    const full = path.join(catalogDir, file);
    const list = JSON.parse(readFileSync(full, "utf8"));
    const next = list.map((work) => {
      if (!work.sampleImageURL && !work.sampleMovieURL) return work;
      const copy = { ...work };
      delete copy.sampleImageURL;
      delete copy.sampleMovieURL;
      return copy;
    });
    writeAtomic(full, `${JSON.stringify(next)}\n`);
  }

  return { backupDir, ...stats, mediaByShard: undefined };
}

function verify() {
  const files = listShardFiles();
  let works = 0;
  let inlineMedia = 0;
  let hydratedOk = 0;
  let hydratedMissing = 0;
  let catalogBytes = 0;
  let mediaBytes = 0;

  for (const file of files) {
    const full = path.join(catalogDir, file);
    const text = readFileSync(full, "utf8");
    catalogBytes += Buffer.byteLength(text);
    const list = JSON.parse(text);
    for (const work of list) {
      works += 1;
      if (work.sampleImageURL || work.sampleMovieURL) inlineMedia += 1;
      const key = shardKey(work.content_id);
      const mediaPath = path.join(mediaDir, `${key}.json`);
      if (!existsSync(mediaPath)) {
        // no media shard is ok if work never had media
        continue;
      }
      const shard = JSON.parse(readFileSync(mediaPath, "utf8"));
      if (shard.entries?.[work.content_id]) hydratedOk += 1;
    }
  }

  if (existsSync(mediaDir)) {
    for (const f of readdirSync(mediaDir).filter((x) => x.endsWith(".json"))) {
      mediaBytes += statSync(path.join(mediaDir, f)).size;
      const shard = JSON.parse(readFileSync(path.join(mediaDir, f), "utf8"));
      for (const id of Object.keys(shard.entries || {})) {
        // count entries that lack matching catalog work later if needed
        void id;
      }
    }
  }

  // recount missing media for works that previously should have media: use media entries vs catalog
  let mediaEntries = 0;
  if (existsSync(mediaDir)) {
    for (const f of readdirSync(mediaDir).filter((x) => x.endsWith(".json"))) {
      const shard = JSON.parse(readFileSync(path.join(mediaDir, f), "utf8"));
      mediaEntries += Object.keys(shard.entries || {}).length;
    }
  }

  return {
    works,
    inlineMedia,
    mediaEntries,
    hydratedOk,
    catalogMb: mb(catalogBytes),
    mediaMb: mb(mediaBytes),
    ok: inlineMedia === 0 && works > 0,
  };
}

function formatPretty() {
  for (const file of listShardFiles()) {
    const full = path.join(catalogDir, file);
    const list = JSON.parse(readFileSync(full, "utf8"));
    writeAtomic(full, `${JSON.stringify(list, null, 2)}\n`);
  }
  return { ok: true };
}

if (mode === "dry-run") {
  const stats = analyze();
  console.log(
    JSON.stringify(
      {
        mode,
        works: stats.works,
        shardCount: stats.shardCount,
        withMedia: stats.withMedia,
        catalogMb: stats.catalogMb,
        mediaEstimateMb: stats.mediaEstimateMb,
        displayEstimateMb: stats.displayEstimateMb,
        mediaShardCount: stats.mediaShardCount,
        missingId: stats.missingId,
        duplicateIds: stats.duplicateIds,
      },
      null,
      2,
    ),
  );
} else if (mode === "split") {
  if (process.env.ADULT_LOCAL_WRITE_ENABLED !== "true") {
    console.error("ADULT_LOCAL_WRITE_ENABLED=true が必要です");
    process.exit(1);
  }
  const result = runSplit();
  console.log(JSON.stringify({ mode, ...result }, null, 2));
} else if (mode === "verify") {
  console.log(JSON.stringify({ mode, ...verify() }, null, 2));
} else if (mode === "format") {
  if (process.env.ADULT_LOCAL_WRITE_ENABLED !== "true") {
    console.error("ADULT_LOCAL_WRITE_ENABLED=true が必要です");
    process.exit(1);
  }
  console.log(JSON.stringify({ mode, ...formatPretty() }, null, 2));
} else {
  console.error("usage: dry-run | split | verify | format");
  process.exit(1);
}
