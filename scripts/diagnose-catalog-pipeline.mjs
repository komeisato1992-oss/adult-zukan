#!/usr/bin/env node
/**
 * カタログ件数パイプラインの実測診断
 * 用法: node scripts/diagnose-catalog-pipeline.mjs [catalog-snapshot.json path]
 */
import { existsSync, readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const DEFAULT_SNAPSHOT = path.join(ROOT, "data", "dmm", "catalog-snapshot.json");
const FANZA_LINK_AFFILIATE_ID = process.env.DMM_FANZA_LINK_AFFILIATE_ID ?? "zukanjp-001";
const DMM_API_AFFILIATE_ID_FALLBACK = "zukanjp-990";

const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|$)/i;
const INVALID_IMAGE_KEYWORDS = ["now_printing", "nowprinting", "noimage"];
const MONO_PLACEHOLDER_PATTERN = /(^|[/_.-])mono([/_.-]|\.|$)/i;

function isValidImageUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (INVALID_IMAGE_KEYWORDS.some((k) => lower.includes(k))) return false;
  if (MONO_PLACEHOLDER_PATTERN.test(trimmed)) return false;
  return IMAGE_EXTENSIONS.test(trimmed);
}

function hasValidImage(item) {
  if (!item.imageURL) return false;
  return [item.imageURL.large, item.imageURL.list, item.imageURL.small].some(
    isValidImageUrl,
  );
}

function getValidImageUrl(item, order = ["large", "list", "small"]) {
  if (!item.imageURL) return undefined;
  for (const key of order) {
    const url = item.imageURL[key];
    if (isValidImageUrl(url)) return url.trim();
  }
}

function getDmmFanzaUrl(item) {
  if (item.URL) {
    return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(item.URL)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
  }
  if (item.affiliateURL) {
    return item.affiliateURL.replace(
      DMM_API_AFFILIATE_ID_FALLBACK,
      FANZA_LINK_AFFILIATE_ID,
    );
  }
  return "";
}

function isVrItem(item) {
  if (item.content_id?.toLowerCase().startsWith("vr")) return true;
  if (item.title?.includes("【VR】") || item.title?.includes("[VR]")) return true;
  const genres = item.iteminfo?.genre ?? [];
  return genres.some((g) => /VR/i.test(g.name));
}

function isValidDmmListItem(item) {
  if (!item.content_id?.trim()) return false;
  if (!item.title?.trim()) return false;
  if (!item.affiliateURL?.trim() && !item.URL?.trim()) return false;
  if (isVrItem(item)) return false;
  if (!hasValidImage(item)) return false;
  if (!getDmmFanzaUrl(item)) return false;
  return Boolean(getValidImageUrl(item, ["large", "list"]));
}

function isDisplayableListItem(item) {
  return isValidDmmListItem(item) && Boolean(getValidImageUrl(item, ["large", "list"]));
}

function loadSnapshot(filePath) {
  const text = readFileSync(filePath, "utf-8");
  const raw = JSON.parse(text);
  const format = Array.isArray(raw)
    ? "array"
    : typeof raw === "object" && raw
      ? `object:${Object.keys(raw).join(",")}`
      : String(typeof raw);
  const items = Array.isArray(raw)
    ? raw
    : raw?.works ?? raw?.items ?? raw?.catalog ?? raw?.data ?? raw?.products ?? [];
  return { raw, items, format };
}

function fingerprint(snapshot) {
  const first = snapshot[0]?.content_id ?? "";
  const last = snapshot[snapshot.length - 1]?.content_id ?? "";
  return `${snapshot.length}:${first}:${last}`;
}

function diagnose(label, filePath, watchIds = []) {
  console.log(`\n========== ${label} ==========`);
  console.log("file:", filePath);
  console.log("exists:", existsSync(filePath));

  const { items, format } = loadSnapshot(filePath);

  console.log("parse format:", format);
  console.log("readCatalogSnapshot total:", items.length);
  const catalogWorks = items.filter(isValidDmmListItem);
  const displayable = catalogWorks.filter(isDisplayableListItem);

  console.log("getCatalogWorks (= filterValidCatalogItems on full snapshot):", catalogWorks.length, "← Dashboard");
  console.log("filterDisplayableItems (/works 表示):", displayable.length);
  console.log("getSearchIndex entries:", catalogWorks.length);
  console.log("fingerprint:", fingerprint(items));
  console.log("first 5 content_ids:", items.slice(0, 5).map((i) => i.content_id));
  console.log("last 3 content_ids:", items.slice(-3).map((i) => i.content_id));

  for (const id of watchIds) {
    const snapIdx = items.findIndex((i) => i.content_id?.toLowerCase() === id.toLowerCase());
    const inValid = catalogWorks.some((i) => i.content_id?.toLowerCase() === id.toLowerCase());
    console.log(`watch ${id}: snapshotIdx=${snapIdx}, inGetCatalogWorks=${inValid}`);
  }

  return {
    snapshotTotal: items.length,
    catalogWorks: catalogWorks.length,
    displayable: displayable.length,
  };
}

const snapshotPath = process.argv[2] ?? DEFAULT_SNAPSHOT;
const watchIds = process.argv.slice(3);
diagnose("Catalog pipeline", snapshotPath, watchIds.length ? watchIds : ["1dldss00509", "cemd00696"]);
