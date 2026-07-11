#!/usr/bin/env node
/**
 * 候補一覧と一括追加で共有するフィルター処理のスモークテスト。
 * 実行: node scripts/test-import-candidate-filters.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const VALID_IMPORT_FILTER_KEYS = new Set([
  "hasImage",
  "hasActress",
  "hasPrice",
  "hasDescription",
  "hasSampleImages",
  "isSoloWork",
  "isOnSale",
  "seoRankingOnly",
  "seoNewReleaseOnly",
  "seoPopularActressOnly",
  "seoPopularMakerOnly",
  "seoPopularSeriesOnly",
]);

const LEGACY_IMPORT_FILTER_KEY_ALIASES = {
  hasSampleImage: "hasSampleImages",
  hasSampleImages: "hasSampleImages",
  singleWork: "isSoloWork",
  isSingleWork: "isSoloWork",
  sale: "isOnSale",
  isSale: "isOnSale",
};

function resolveImportFilterKey(raw) {
  const key = raw.trim();
  if (!key) return null;
  if (VALID_IMPORT_FILTER_KEYS.has(key)) return key;
  const alias = LEGACY_IMPORT_FILTER_KEY_ALIASES[key];
  if (alias && VALID_IMPORT_FILTER_KEYS.has(alias)) return alias;
  return null;
}

function normalizeImportCandidateFilterKeys(keys) {
  const normalized = [];
  const seen = new Set();
  for (const raw of keys) {
    if (typeof raw !== "string") continue;
    const key = resolveImportFilterKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function parseImportCandidateFilters(input) {
  if (input == null) return [];
  if (typeof input === "string") {
    if (!input.trim()) return [];
    return normalizeImportCandidateFilterKeys(input.split(","));
  }
  if (Array.isArray(input)) {
    return normalizeImportCandidateFilterKeys(
      input.filter((entry) => typeof entry === "string"),
    );
  }
  if (typeof input === "object") {
    const active = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === true) active.push(key);
    }
    return normalizeImportCandidateFilterKeys(active);
  }
  return [];
}

function getImportQualityFlags(item) {
  const actresses = item.actresses ?? [];
  const imageURL = item.imageURL?.trim();
  return {
    hasImage: Boolean(imageURL),
    hasActress: actresses.length > 0,
    hasPrice: Boolean(item.price?.trim()),
    hasDescription: Boolean(item.description?.trim()),
    hasSampleImages: Array.isArray(item.sampleImages) && item.sampleImages.length > 0,
    isSoloWork: actresses.length === 1,
    isOnSale: false,
  };
}

function matchesImportRecordFilters(record, activeFilters) {
  if (activeFilters.size === 0) return true;
  const flags = getImportQualityFlags(record);
  const qualityFilters = [...activeFilters].filter((key) => key in flags);
  if (qualityFilters.length === 0) return true;
  return qualityFilters.every((key) => flags[key]);
}

function isPendingImportCandidate(record) {
  if (record.status === "added" || record.status === "excluded") return false;
  return Boolean(record.content_id?.trim() && record.title?.trim());
}

function applyPipeline(records, filtersInput, excludedIds = [], addLimit) {
  const filters = parseImportCandidateFilters(filtersInput);
  const filterSet = new Set(filters);
  const pending = records.filter(isPendingImportCandidate);
  const qualityFiltered = pending.filter((record) =>
    matchesImportRecordFilters(record, filterSet),
  );
  const excluded = new Set(
    excludedIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const afterExcluded = qualityFiltered.filter(
    (record) => !excluded.has(record.content_id.trim().toLowerCase()),
  );
  const limited =
    typeof addLimit === "number" && addLimit > 0
      ? afterExcluded.slice(0, addLimit)
      : afterExcluded;

  return {
    filters,
    rawCandidateCount: records.length,
    pendingCandidateCount: pending.length,
    afterQualityFilterCount: qualityFiltered.length,
    afterExcludedIdsCount: afterExcluded.length,
    afterLimitCount: limited.length,
    candidates: limited,
  };
}

function loadFixtureRecords() {
  const file = path.join(root, "data/dmm/import-candidates.json");
  const parsed = JSON.parse(readFileSync(file, "utf-8"));
  return Array.isArray(parsed) ? parsed : [];
}

const records = loadFixtureRecords();
assert.ok(records.length > 0, "fixture records should not be empty");

// フィルター未選択で全件返る
{
  const result = applyPipeline(records, []);
  assert.equal(result.afterQualityFilterCount, result.pendingCandidateCount);
  assert.ok(result.afterQualityFilterCount > 0);
}

// hasImage=true で画像ありだけ返る
{
  const result = applyPipeline(records, ["hasImage"]);
  assert.ok(result.afterQualityFilterCount > 0);
  assert.ok(result.afterQualityFilterCount <= result.pendingCandidateCount);
  for (const record of result.candidates) {
    assert.ok(getImportQualityFlags(record).hasImage);
  }
}

// hasImage=false オブジェクトは条件なし（0件にならない）
{
  const result = applyPipeline(records, {
    hasImage: false,
    hasActress: false,
    hasPrice: false,
  });
  assert.equal(result.filters.length, 0);
  assert.equal(result.afterQualityFilterCount, result.pendingCandidateCount);
}

// 旧キー名は正規化される
{
  const result = applyPipeline(records, ["hasSampleImage", "singleWork", "sale"]);
  assert.deepEqual(result.filters, ["hasSampleImages", "isSoloWork", "isOnSale"]);
}

// 未知キーは無視され0件にならない
{
  const result = applyPipeline(records, ["unknownFilter", ""]);
  assert.equal(result.filters.length, 0);
  assert.equal(result.afterQualityFilterCount, result.pendingCandidateCount);
}

// status なしは candidate 扱いで除外しない
{
  const custom = [
    {
      content_id: "test001",
      title: "Test Work",
      status: undefined,
      actresses: ["A"],
      imageURL: "https://example.com/a.jpg",
      price: "100",
    },
  ];
  const result = applyPipeline(custom, []);
  assert.equal(result.afterQualityFilterCount, 1);
}

// added / excluded は除外
{
  const custom = [
    {
      content_id: "added001",
      title: "Added",
      status: "added",
    },
    {
      content_id: "excluded001",
      title: "Excluded",
      status: "excluded",
    },
    {
      content_id: "pending001",
      title: "Pending",
      status: "candidate",
    },
  ];
  const result = applyPipeline(custom, []);
  assert.equal(result.pendingCandidateCount, 1);
}

// allMatching + excludedIds
{
  const result = applyPipeline(records, [], [records[0].content_id]);
  assert.equal(
    result.afterExcludedIdsCount,
    result.afterQualityFilterCount - 1,
  );
}

// addLimit 適用
{
  const result = applyPipeline(records, [], [], 300);
  assert.equal(result.afterLimitCount, Math.min(300, result.afterExcludedIdsCount));
}

console.log("import-candidate-filters checks passed", {
  fixtureCount: records.length,
  pendingCount: applyPipeline(records, []).pendingCandidateCount,
});
