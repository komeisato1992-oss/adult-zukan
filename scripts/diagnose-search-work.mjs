#!/usr/bin/env node
/**
 * 検索正規化・マッチの実測
 */
import { readFileSync } from "fs";

function katakanaToHiragana(text) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function normalizeSearchText(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  let normalized = trimmed.normalize("NFKC");
  normalized = normalized.replace(/[\s\u3000]+/g, " ");
  normalized = katakanaToHiragana(normalized.toLowerCase());
  normalized = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  return normalized;
}

function getActressNames(item) {
  return (item.actress ?? item.iteminfo?.actress ?? []).map((a) => a.name).filter(Boolean);
}
function getMaker(item) {
  return item.maker?.[0]?.name ?? item.iteminfo?.maker?.[0]?.name ?? "";
}
function getLabel(item) {
  return item.label?.[0]?.name ?? item.iteminfo?.label?.[0]?.name ?? "";
}
function getSeries(item) {
  return item.series?.[0]?.name ?? item.iteminfo?.series?.[0]?.name ?? "";
}
function getGenres(item) {
  return (item.iteminfo?.genre ?? []).map((g) => g.name).filter(Boolean).join(" ");
}

function buildSearchFields(item) {
  return [
    normalizeSearchText(item.title ?? ""),
    normalizeSearchText(getActressNames(item).join(" ")),
    normalizeSearchText(getMaker(item)),
    normalizeSearchText(getLabel(item)),
    normalizeSearchText(getSeries(item)),
    normalizeSearchText(getGenres(item)),
    normalizeSearchText(item.content_id ?? ""),
    normalizeSearchText(item.product_id ?? ""),
  ].filter(Boolean);
}

function matches(fields, query) {
  const q = normalizeSearchText(query);
  return fields.some((f) => f.includes(q));
}

const path = process.argv[2] ?? "/tmp/post-prebuild-2000.json";
const cid = process.argv[3] ?? "1dldss00509";
const items = JSON.parse(readFileSync(path, "utf-8"));
const item = items.find((i) => i.content_id?.toLowerCase() === cid.toLowerCase());
if (!item) {
  console.error("work not found");
  process.exit(1);
}

const fields = buildSearchFields(item);
const fieldNames = ["title", "actress", "maker", "label", "series", "genre", "contentId", "productId"];

console.log("=== normalized fields ===");
fieldNames.forEach((name, i) => {
  if (fields[i]) console.log(`${name}:`, fields[i].slice(0, 120));
});

const queries = [
  "路地裏チャイナドレス",
  "路地裏 チャイナドレス",
  "路地裏　チャイナドレス",
  "路地裏チャイナドレスBAR",
  "チャイナドレス",
  "小沢菜穂",
  "1dldss00509",
];

console.log("\n=== match results ===");
for (const q of queries) {
  console.log(JSON.stringify(q), "→", matches(fields, q));
}
