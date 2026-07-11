#!/usr/bin/env node
/**
 * 人気順と追加順の差分を確認する。
 * 実行: node scripts/verify-works-sort.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(__dirname, "../data/dmm/catalog-snapshot.json");

function parseReviewAverage(value) {
  if (!value?.trim()) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getPopularityBreakdown(item) {
  const rank =
    typeof item.sourcePopularityRank === "number" &&
    Number.isFinite(item.sourcePopularityRank) &&
    item.sourcePopularityRank > 0
      ? item.sourcePopularityRank
      : null;
  const reviewCount =
    typeof item.review?.count === "number" && item.review.count > 0
      ? item.review.count
      : 0;
  const reviewAverage = parseReviewAverage(item.review?.average);
  const reviewScore =
    reviewCount > 0 && reviewAverage > 0 ? reviewCount * reviewAverage : 0;

  if (rank != null) {
    return {
      hasPopularityData: true,
      source: "rank",
      sourcePopularityRank: rank,
      popularityScore: 10_000_000 - rank,
    };
  }
  if (reviewScore > 0) {
    return {
      hasPopularityData: true,
      source: "review",
      sourcePopularityRank: null,
      popularityScore: reviewScore,
    };
  }
  return {
    hasPopularityData: false,
    source: "none",
    sourcePopularityRank: null,
    popularityScore: Number.NEGATIVE_INFINITY,
  };
}

function comparePopular(a, b) {
  const aBreakdown = getPopularityBreakdown(a);
  const bBreakdown = getPopularityBreakdown(b);
  if (aBreakdown.hasPopularityData !== bBreakdown.hasPopularityData) {
    return aBreakdown.hasPopularityData ? -1 : 1;
  }
  if (aBreakdown.popularityScore !== bBreakdown.popularityScore) {
    return bBreakdown.popularityScore - aBreakdown.popularityScore;
  }
  return 0;
}

function compareAdded(a, b, catalogOrder) {
  const addedA = Date.parse(a.addedAt ?? "") || 0;
  const addedB = Date.parse(b.addedAt ?? "") || 0;
  if (addedA !== addedB) return addedB - addedA;
  return (catalogOrder.get(a.content_id) ?? Number.MAX_SAFE_INTEGER) -
    (catalogOrder.get(b.content_id) ?? Number.MAX_SAFE_INTEGER);
}

function loadCatalog() {
  const parsed = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  return Array.isArray(parsed) ? parsed : parsed.works ?? parsed.items ?? [];
}

const catalog = loadCatalog();
assert.ok(catalog.length > 0, "catalog should not be empty");

const catalogOrder = new Map(
  catalog.map((item, index) => [item.content_id, index]),
);

const popularSorted = [...catalog].sort(comparePopular);
const addedSorted = [...catalog].sort((a, b) => compareAdded(a, b, catalogOrder));

const popularTop = popularSorted.slice(0, 20).map((item, index) => {
  const breakdown = getPopularityBreakdown(item);
  return {
    rank: index + 1,
    content_id: item.content_id,
    title: item.title?.slice(0, 40),
    popularitySource: breakdown.source,
    sourcePopularityRank: breakdown.sourcePopularityRank,
    popularityScore: breakdown.popularityScore,
    catalogIndex: catalogOrder.get(item.content_id),
    addedAt: item.addedAt ?? null,
    releaseDate: item.date ?? null,
  };
});

const addedTop = addedSorted.slice(0, 20).map((item, index) => ({
  rank: index + 1,
  content_id: item.content_id,
  title: item.title?.slice(0, 40),
  catalogIndex: catalogOrder.get(item.content_id),
  addedAt: item.addedAt ?? null,
  releaseDate: item.date ?? null,
}));

const popularIds = popularTop.map((entry) => entry.content_id);
const addedIds = addedTop.map((entry) => entry.content_id);
const overlap = popularIds.filter((id, index) => addedIds[index] === id).length;

console.log("=== 人気順 先頭20件 ===");
console.table(popularTop);
console.log("=== 追加順 先頭20件 ===");
console.table(addedTop);

const withRank = catalog.filter(
  (item) =>
    typeof item.sourcePopularityRank === "number" && item.sourcePopularityRank > 0,
).length;
const withReview = catalog.filter((item) => getPopularityBreakdown(item).source === "review")
  .length;
const withAddedAt = catalog.filter((item) => item.addedAt).length;

console.log({
  catalogCount: catalog.length,
  withSourcePopularityRank: withRank,
  withReviewPopularity: withReview,
  withAddedAt,
  popularVsAddedTop20SamePositionCount: overlap,
});

assert.ok(
  popularTop.some((entry) => entry.popularitySource !== "none") ||
    withRank > 0 ||
    withReview > 0,
  "popularity data should exist in catalog or review fallback",
);

console.log("verify-works-sort checks passed");
