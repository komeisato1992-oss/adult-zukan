#!/usr/bin/env node
import assert from "node:assert/strict";

const IMPORT_BULK_ADD_DEFAULT = 200;
const IMPORT_BULK_ADD_ABSOLUTE_MAX = 1000;

function resolveBulkAddLimit(addLimit, selectedCount) {
  if (selectedCount <= 0) return 0;
  if (addLimit === "all") {
    return Math.min(selectedCount, IMPORT_BULK_ADD_ABSOLUTE_MAX);
  }
  const requestedLimit = Number(addLimit);
  return Math.min(
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : IMPORT_BULK_ADD_DEFAULT,
    IMPORT_BULK_ADD_ABSOLUTE_MAX,
    selectedCount,
  );
}

function parseBulkAddRequestBody(body) {
  const rawWorks = body.selectedWorks;
  if (!Array.isArray(rawWorks) || rawWorks.length === 0) {
    throw new Error("no works");
  }
  const appliedLimit = resolveBulkAddLimit(body.addLimit, rawWorks.length);
  return {
    appliedLimit,
    works: rawWorks.slice(0, appliedLimit),
  };
}

const works = Array.from({ length: 200 }, (_, index) => ({
  contentId: `work${index + 1}`,
}));

assert.equal(resolveBulkAddLimit(200, 200), 200);
assert.equal(resolveBulkAddLimit("all", 200), 200);
assert.equal(resolveBulkAddLimit(500, 200), 200);

const parsed = parseBulkAddRequestBody({ selectedWorks: works, addLimit: 200 });
assert.equal(parsed.appliedLimit, 200);
assert.equal(parsed.works.length, 200);

console.log("bulk-add-limit checks passed");
