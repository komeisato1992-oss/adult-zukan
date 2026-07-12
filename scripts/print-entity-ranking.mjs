/**
 * Print entity ranking TOP10 from catalog shards (no Next server-only).
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";

const root = path.join(process.cwd(), "data/dmm/catalog");
const files = readdirSync(root)
  .filter((f) => /^catalog-\d+\.json$/.test(f))
  .sort();

function isVr(item) {
  if (String(item.content_id ?? "").toLowerCase().startsWith("vr")) return true;
  if (String(item.title ?? "").includes("【VR】")) return true;
  return false;
}

function actressNames(item) {
  const list = item.actress ?? item.iteminfo?.actress ?? [];
  return list.map((a) => a?.name).filter(Boolean);
}

function makerName(item) {
  return item.iteminfo?.maker?.[0]?.name ?? item.maker?.name ?? null;
}

function seriesName(item) {
  return item.iteminfo?.series?.[0]?.name ?? item.series?.name ?? null;
}

function points(item) {
  const rank = item.sourcePopularityRank;
  if (typeof rank === "number" && rank > 0) return Math.max(0, 2000 - rank);
  return 0;
}

function isRecent(item, now) {
  const raw = item.date?.trim();
  if (!raw) return false;
  const ts = Date.parse(raw.replace(" ", "T"));
  return Number.isFinite(ts) && now - ts <= 90 * 86400000;
}

const now = Date.now();
const actress = new Map();
const maker = new Map();
const series = new Map();

for (const file of files) {
  const items = JSON.parse(readFileSync(path.join(root, file), "utf-8"));
  for (const item of items) {
    if (!item?.content_id || !item?.title || isVr(item)) continue;
    if (!item.affiliateURL && !item.URL) continue;
    const pop = points(item);
    const recent = isRecent(item, now);
    const popular = typeof item.sourcePopularityRank === "number" && item.sourcePopularityRank <= 500;

    for (const name of actressNames(item)) {
      const row = actress.get(name) ?? { name, workCount: 0, pop: 0, popular: 0, recent: 0 };
      row.workCount += 1;
      row.pop += pop;
      if (popular) row.popular += 1;
      if (recent) row.recent += 1;
      actress.set(name, row);
    }
    const m = makerName(item);
    if (m) {
      const row = maker.get(m) ?? { name: m, workCount: 0, pop: 0, popular: 0, recent: 0 };
      row.workCount += 1;
      row.pop += pop;
      if (popular) row.popular += 1;
      if (recent) row.recent += 1;
      maker.set(m, row);
    }
    const s = seriesName(item);
    if (s) {
      const row = series.get(s) ?? { name: s, workCount: 0, pop: 0, popular: 0, recent: 0 };
      row.workCount += 1;
      row.pop += pop;
      if (popular) row.popular += 1;
      if (recent) row.recent += 1;
      series.set(s, row);
    }
  }
}

function rank(map, formula) {
  return [...map.values()]
    .filter((r) => r.workCount >= 1)
    .map((r) => ({ ...r, score: formula(r) }))
    .sort((a, b) => b.score - a.score || b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"))
    .slice(0, 10);
}

const a = rank(actress, (r) => r.workCount * 10 + r.pop + r.popular * 50 + r.recent * 5);
const m = rank(maker, (r) => r.workCount * 5 + r.pop + r.popular * 20 + r.recent * 3);
const s = rank(series, (r) => r.workCount * 7 + r.pop + r.popular * 15 + r.recent * 3);

console.log("=== 人気女優 TOP10 ===");
a.forEach((x, i) => console.log(`${i + 1}. ${x.name} / ${x.workCount}作品 / score=${x.score}`));
console.log("=== 人気メーカー TOP10 ===");
m.forEach((x, i) => console.log(`${i + 1}. ${x.name} / ${x.workCount}作品 / score=${x.score}`));
console.log("=== 人気シリーズ TOP10 ===");
s.forEach((x, i) => console.log(`${i + 1}. ${x.name} / ${x.workCount}作品 / score=${x.score}`));
