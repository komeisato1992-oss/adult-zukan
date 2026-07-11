#!/usr/bin/env node
/**
 * 女優代表画像選定の確認スクリプト
 * node scripts/verify-actress-representative-images.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function getActressNames(item) {
  const raw = item.actress ?? item.iteminfo?.actress;
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries
    .map((entry) => (typeof entry === "string" ? entry : entry?.name))
    .map((name) => String(name ?? "").trim())
    .filter(Boolean);
}

function getGenres(item) {
  const raw = item.iteminfo?.genre;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? entry : entry?.name))
    .map((name) => String(name ?? "").trim())
    .filter(Boolean);
}

function isSoloGenre(genres) {
  return genres.some((g) => {
    const n = g.toLowerCase().replace(/\s+/g, "");
    return n === "単体作品" || n === "単体" || n === "solo";
  });
}

function isCompilation(item, genres) {
  const title = String(item.title ?? "");
  return (
    genres.some((g) => /総集編|ベスト|オムニバス|作品集|best/i.test(g)) ||
    /総集編|BEST|ベスト|オムニバス|作品集|\d+\s*時間/i.test(title)
  );
}

function hasBodyFocus(genres) {
  return genres.some((g) => g.includes("局部"));
}

function scoreWork(item, actressName, catalogIndex) {
  const imageUrl = item.imageURL?.large || item.imageURL?.list;
  if (!imageUrl || /now_printing|mono/i.test(imageUrl)) return null;
  const names = getActressNames(item);
  if (!names.includes(actressName)) return null;
  const genres = getGenres(item);
  const actressCount = names.length;
  const isSoloGenreFlag = isSoloGenre(genres);
  const isSoloWork = isSoloGenreFlag || actressCount === 1;
  const compilation = isCompilation(item, genres);
  const bodyFocus = hasBodyFocus(genres);
  let score = 0;
  if (isSoloGenreFlag && !compilation) score += 100;
  else if (actressCount === 1 && !compilation) score += 80;
  else if (isSoloGenreFlag) score += 40;
  else if (actressCount === 1) score += 30;
  if (names[0] === actressName) score += 30;
  if (String(item.title ?? "").includes(actressName)) score += 20;
  let faceLikely = false;
  if (isSoloWork && !compilation && !bodyFocus) {
    faceLikely = true;
    score += 100;
  }
  if (bodyFocus) {
    score -= 120;
    faceLikely = false;
  }
  if (compilation) score -= 80;
  if (actressCount >= 5) score -= 60;
  else if (actressCount >= 3) score -= 35;
  else if (actressCount >= 2) score -= 20;
  if (/pl\.jpe?g/i.test(imageUrl)) score += 10;
  if (catalogIndex < 500) score += 8;
  return {
    contentId: item.content_id,
    imageUrl,
    score,
    isSoloWork,
    faceLikely,
    compilation,
    bodyFocus,
    genres: genres.filter((g) => /単体|総集|局部|ベスト/i.test(g)),
  };
}

function loadWorks() {
  const dir = path.join(ROOT, "data/dmm/catalog");
  const files = readdirSync(dir)
    .filter((f) => /^catalog-\d+\.json$/i.test(f))
    .sort();
  const works = [];
  for (const file of files) {
    works.push(...JSON.parse(readFileSync(path.join(dir, file), "utf8")));
  }
  return works;
}

function selectForActress(works, actressName) {
  const scored = [];
  works.forEach((item, index) => {
    const result = scoreWork(item, actressName, index);
    if (result) scored.push(result);
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 25) return { selection: null, candidates: scored.slice(0, 5) };
  return { selection: best, candidates: scored.slice(0, 5) };
}

const works = loadWorks();
const actressCount = new Map();
for (const item of works) {
  for (const name of getActressNames(item)) {
    actressCount.set(name, (actressCount.get(name) ?? 0) + 1);
  }
}

const target = "渚みつき";
const beforeUrl =
  "https://pics.dmm.co.jp/digital/video/1sbp00395/1sbp00395pl.jpg";
const nagisa = selectForActress(works, target);

console.log("=== 渚みつき ===");
console.log("修正前画像:", beforeUrl);
console.log("修正後画像:", nagisa.selection?.imageUrl ?? "(default)");
console.log("選定元作品:", nagisa.selection?.contentId ?? "-");
console.log("単体作品:", nagisa.selection?.isSoloWork ?? false);
console.log("顔推定:", nagisa.selection?.faceLikely ?? false);
console.log("スコア:", nagisa.selection?.score ?? "-");
console.log("top candidates:");
for (const c of nagisa.candidates) {
  console.log(
    `  ${c.contentId} score=${c.score} solo=${c.isSoloWork} face=${c.faceLikely} body=${c.bodyFocus} comp=${c.compilation} ${c.genres.join(",")}`,
  );
}

const names = [...actressCount.entries()]
  .filter(([, count]) => count >= 3)
  .sort((a, b) => b[1] - a[1])
  .map(([name]) => name);

// deterministic pseudo-random 20
const picked = [];
for (let i = 0; i < names.length && picked.length < 20; i += 7) {
  picked.push(names[i]);
}
if (!picked.includes(target)) picked[0] = target;

let faceNone = 0;
let compilationPick = 0;
let defaultPick = 0;
let soloPick = 0;

console.log("\n=== random/sample 20 ===");
for (const name of picked.slice(0, 20)) {
  const result = selectForActress(works, name);
  const sel = result.selection;
  if (!sel) {
    defaultPick += 1;
    console.log(`${name}: DEFAULT`);
    continue;
  }
  if (!sel.faceLikely) faceNone += 1;
  if (sel.compilation) compilationPick += 1;
  if (sel.isSoloWork) soloPick += 1;
  console.log(
    `${name}: ${sel.contentId} score=${sel.score} solo=${sel.isSoloWork} face=${sel.faceLikely}`,
  );
}

console.log("\nsummary:");
console.log({
  sampled: Math.min(20, picked.length),
  soloPick,
  faceUnlikely: faceNone,
  compilationPick,
  defaultPick,
  nagisaChanged: nagisa.selection?.imageUrl !== beforeUrl,
  nagisaNotBodyFocus: nagisa.selection ? !nagisa.selection.bodyFocus : true,
});

if (nagisa.selection?.bodyFocus) {
  console.error("FAIL: 渚みつき still body-focus image");
  process.exit(1);
}
if (nagisa.selection?.imageUrl === beforeUrl) {
  console.error("FAIL: 渚みつき image unchanged from body-focus package");
  process.exit(1);
}
console.log("\nverify-actress-representative-images: passed");
