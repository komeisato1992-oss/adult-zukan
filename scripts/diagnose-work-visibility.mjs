#!/usr/bin/env node
/**
 * 作品の各ページ反映条件を実測
 */
import { readFileSync } from "fs";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const FANZA_LINK_AFFILIATE_ID = process.env.DMM_FANZA_LINK_AFFILIATE_ID ?? "zukanjp-001";
const DMM_API_AFFILIATE_ID_FALLBACK = "zukanjp-990";
const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|$)/i;

function isValidImageUrl(url) {
  const t = url?.trim();
  if (!t) return false;
  const l = t.toLowerCase();
  if (["now_printing", "nowprinting", "noimage"].some((k) => l.includes(k))) return false;
  return IMAGE_EXTENSIONS.test(t);
}

function hasValidImage(item) {
  return [item.imageURL?.large, item.imageURL?.list, item.imageURL?.small].some(isValidImageUrl);
}

function getValidImageUrl(item, order = ["large", "list", "small"]) {
  for (const k of order) {
    const u = item.imageURL?.[k];
    if (isValidImageUrl(u)) return u.trim();
  }
}

function getDmmFanzaUrl(item) {
  if (item.URL) return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(item.URL)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
  if (item.affiliateURL) return item.affiliateURL.replace(DMM_API_AFFILIATE_ID_FALLBACK, FANZA_LINK_AFFILIATE_ID);
  return "";
}

function isVrItem(item) {
  if (item.content_id?.toLowerCase().startsWith("vr")) return true;
  if (item.title?.includes("【VR】") || item.title?.includes("[VR]")) return true;
  return (item.iteminfo?.genre ?? []).some((g) => /VR/i.test(g.name));
}

function isValidDmmListItem(item) {
  const checks = {
    content_id: Boolean(item.content_id?.trim()),
    title: Boolean(item.title?.trim()),
    url: Boolean(item.affiliateURL?.trim() || item.URL?.trim()),
    notVr: !isVrItem(item),
    hasValidImage: hasValidImage(item),
    fanzaUrl: Boolean(getDmmFanzaUrl(item)),
    largeOrListImage: Boolean(getValidImageUrl(item, ["large", "list"])),
  };
  checks.pass = Object.entries(checks).every(([k, v]) => k === "pass" || v);
  return checks;
}

function isDisplayableListItem(item) {
  const v = isValidDmmListItem(item);
  const listImage = Boolean(getValidImageUrl(item, ["large", "list"]));
  return { pass: v.pass && listImage, listImage, validChecks: v };
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
  return (item.iteminfo?.genre ?? []).map((g) => g.name).filter(Boolean);
}

const filePath = process.argv[2] ?? "data/dmm/catalog-snapshot.json";
const cid = (process.argv[3] ?? "1dldss00509").toLowerCase();
const items = JSON.parse(readFileSync(filePath, "utf-8"));
const catalogWorks = items.filter((i) => isValidDmmListItem(i).pass);
const displayable = catalogWorks.filter((i) => isDisplayableListItem(i).pass);
const item = items.find((i) => i.content_id?.toLowerCase() === cid);

console.log("=== Count comparison ===");
console.log("snapshot total:", items.length);
console.log("getCatalogWorks (filterValidCatalogItems):", catalogWorks.length, "← Dashboard");
console.log("filterDisplayableItems (/works):", displayable.length);

if (!item) {
  console.log("work not found");
  process.exit(1);
}

const inCatalogWorks = catalogWorks.some((i) => i.content_id.toLowerCase() === cid);
const inDisplayable = displayable.some((i) => i.content_id.toLowerCase() === cid);

console.log("\n=== Work:", cid, "===");
console.log("in getCatalogWorks:", inCatalogWorks);
console.log("in filterDisplayableItems:", inDisplayable);

console.log("\n=== Entity fields ===");
console.log("actresses:", getActressNames(item));
console.log("maker:", getMaker(item), "slug:", slugify(getMaker(item)));
console.log("label:", getLabel(item), "slug:", slugify(getLabel(item)));
console.log("series:", JSON.stringify(getSeries(item)));
console.log("genres:", getGenres(item));
