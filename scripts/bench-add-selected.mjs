#!/usr/bin/env node
/**
 * add-selected 処理のオフライン所要時間見積もり（GitHub通信なし）
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function time(label, fn) {
  const t0 = Date.now();
  const result = fn();
  const ms = Date.now() - t0;
  console.log(`[bench] ${label}`, { ms, sec: (ms / 1000).toFixed(2) });
  return result;
}

const rawText = readFileSync(resolve(root, "data/dmm/catalog-snapshot.json"), "utf8");
const raw = time("parse-catalog-json", () => JSON.parse(rawText));
const items = Array.isArray(raw) ? raw : raw.items ?? raw.works ?? [];

console.log("[bench] catalog", {
  itemCount: items.length,
  fileBytes: Buffer.byteLength(rawText, "utf8"),
  fileMb: (Buffer.byteLength(rawText, "utf8") / 1024 / 1024).toFixed(2),
});

// 簡易インデックス再構築（本番 rebuildAllIndexes の近似）
function rebuildIndexes(catalogItems) {
  const actressMap = new Map();
  const makerMap = new Map();
  const labelMap = new Map();
  const seriesMap = new Map();
  const genreMap = new Map();
  const searchIndex = [];

  for (const item of catalogItems) {
    const info = item.iteminfo ?? {};
    for (const actress of info.actress ?? []) {
      if (actress?.name) actressMap.set(actress.name, (actressMap.get(actress.name) ?? 0) + 1);
    }
    for (const maker of info.maker ?? []) {
      if (maker?.name) makerMap.set(maker.name, (makerMap.get(maker.name) ?? 0) + 1);
    }
    for (const label of info.label ?? []) {
      if (label?.name) labelMap.set(label.name, (labelMap.get(label.name) ?? 0) + 1);
    }
    for (const series of info.series ?? []) {
      if (series?.name) seriesMap.set(series.name, (seriesMap.get(series.name) ?? 0) + 1);
    }
    for (const genre of info.genre ?? []) {
      if (genre?.name) genreMap.set(genre.name, (genreMap.get(genre.name) ?? 0) + 1);
    }

    const fields = [
      item.content_id,
      item.title,
      item.product_id,
      ...(info.actress ?? []).map((a) => a?.name).filter(Boolean),
      ...(info.genre ?? []).map((g) => g?.name).filter(Boolean),
    ];
    searchIndex.push({ contentId: item.content_id, searchFields: fields });
  }

  return {
    actresses: [...actressMap.entries()],
    makers: [...makerMap.entries()],
    labels: [...labelMap.entries()],
    series: [...seriesMap.entries()],
    genres: [...genreMap.entries()],
    searchIndex,
  };
}

time("rebuild-indexes-1", () => rebuildIndexes(items));
time("rebuild-indexes-2-deployed-double", () => {
  rebuildIndexes(items);
  rebuildIndexes(items);
});

const merged = time("merge-50-items", () => {
  const fakeNew = items.slice(0, 50).map((item, i) => ({
    ...item,
    content_id: `benchtest${String(i).padStart(5, "0")}`,
    product_id: `benchtest${String(i).padStart(5, "0")}`,
  }));
  return [...fakeNew, ...items];
});

const nextIndexes = time("rebuild-indexes-after-merge", () => rebuildIndexes(merged));

const serializedCatalog = time("serialize-catalog", () =>
  JSON.stringify(Array.isArray(raw) ? merged : { ...raw, items: merged }),
);

const indexSizes = time("serialize-indexes", () => {
  const files = {
    actresses: JSON.stringify({ items: nextIndexes.actresses }),
    searchIndex: JSON.stringify({ items: nextIndexes.searchIndex }),
    makers: JSON.stringify({ items: nextIndexes.makers }),
    labels: JSON.stringify({ items: nextIndexes.labels }),
    series: JSON.stringify({ items: nextIndexes.series }),
    genres: JSON.stringify({ items: nextIndexes.genres }),
  };
  const total = Object.values(files).reduce((sum, v) => sum + Buffer.byteLength(v, "utf8"), 0);
  console.log("[bench] index-bytes", Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k, Buffer.byteLength(v, "utf8")]),
  ));
  return total;
});

console.log("[bench] totals", {
  catalogSerializedMb: (Buffer.byteLength(serializedCatalog, "utf8") / 1024 / 1024).toFixed(2),
  indexSerializedMb: (indexSizes / 1024 / 1024).toFixed(2),
  combinedMb: (
    (Buffer.byteLength(serializedCatalog, "utf8") + indexSizes) /
    1024 /
    1024
  ).toFixed(2),
});
