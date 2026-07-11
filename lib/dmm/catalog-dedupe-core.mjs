/**
 * カタログ重複排除の共通ロジック（Node / スクリプト用）
 */

/** @param {unknown} value */
export function normalizeWorkId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** @param {Record<string, unknown>} work */
export function getWorkMatchKeys(work) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const field of ["content_id", "product_id"]) {
    const raw = work[field];
    if (!raw) continue;
    const trimmed = String(raw).trim().toLowerCase();
    if (trimmed) keys.add(`raw:${field}:${trimmed}`);
    const normalized = normalizeWorkId(raw);
    if (normalized) keys.add(`norm:${field}:${normalized}`);
  }
  return keys;
}

/** @param {Record<string, unknown>} work */
export function hasWorkIdentity(work) {
  return Boolean(
    String(work.content_id ?? "").trim() || String(work.product_id ?? "").trim(),
  );
}

/** @param {Record<string, unknown>} item */
function hasImage(item) {
  const imageURL = /** @type {{large?: string; list?: string; small?: string} | undefined} */ (
    item.imageURL
  );
  return Boolean(
    imageURL?.large?.trim() || imageURL?.list?.trim() || imageURL?.small?.trim(),
  );
}

/** @param {unknown} value */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {Record<string, unknown>} item */
function actressCount(item) {
  const iteminfo = /** @type {{actress?: unknown[]}} */ (item.iteminfo ?? {});
  return Array.isArray(iteminfo.actress) ? iteminfo.actress.length : 0;
}

/** @param {Record<string, unknown>} item */
function sampleImageCount(item) {
  const sample = item.sampleImageURL;
  if (!sample || typeof sample !== "object") return 0;
  return Object.values(sample).filter((v) => nonEmptyString(v)).length;
}

/** @param {Record<string, unknown>} item */
function iteminfoRichness(item) {
  const iteminfo = /** @type {Record<string, unknown[]>} */ (item.iteminfo ?? {});
  let score = 0;
  for (const key of ["actress", "genre", "maker", "label", "series"]) {
    const value = iteminfo[key];
    if (Array.isArray(value) && value.length > 0) score += 1;
  }
  return score;
}

/** @param {Record<string, unknown>} item @param {number} index */
export function scoreCatalogWork(item, index) {
  let score = 0;
  if (hasImage(item)) score += 1000;
  if (nonEmptyString(item.title)) score += 500;
  if (actressCount(item) > 0) score += 200;
  if (nonEmptyString(/** @type {{price?: string}} */ (item.prices ?? {}).price))
    score += 100;
  if (nonEmptyString(item.description)) score += 80;
  if (sampleImageCount(item) > 0) score += 60;
  if (nonEmptyString(item.affiliateURL) || nonEmptyString(item.URL)) score += 40;
  score += iteminfoRichness(item) * 10;
  if (typeof item.sourcePopularityRank === "number") score += 5;
  if (nonEmptyString(item.addedAt)) score += 3;
  // 同点時は先頭（小さい index）を優先
  score -= index * 0.0001;
  return score;
}

/** @param {unknown} value */
function uniqueNamedEntries(value) {
  if (!Array.isArray(value)) return value;
  /** @type {Map<string, unknown>} */
  const seen = new Map();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const name = String(/** @type {{name?: string}} */ (entry).name ?? "").trim();
    const key = name.toLowerCase() || JSON.stringify(entry);
    if (!seen.has(key)) seen.set(key, entry);
  }
  return [...seen.values()];
}

/** @param {Record<string, unknown>} target @param {Record<string, unknown>} source */
function mergeNamedArrayField(target, source, field) {
  const targetInfo = /** @type {Record<string, unknown[]>} */ ({
    ...(target.iteminfo ?? {}),
  });
  const sourceInfo = /** @type {Record<string, unknown[]>} */ (source.iteminfo ?? {});
  const merged = uniqueNamedEntries([
    ...(Array.isArray(targetInfo[field]) ? targetInfo[field] : []),
    ...(Array.isArray(sourceInfo[field]) ? sourceInfo[field] : []),
  ]);
  if (merged.length === 0) return target;
  return {
    ...target,
    iteminfo: {
      ...targetInfo,
      [field]: merged,
    },
  };
}

/** @param {Record<string, unknown>} target @param {Record<string, unknown>} source */
function mergeSampleImages(target, source) {
  const targetSample = /** @type {Record<string, string>} */ ({
    ...((target.sampleImageURL && typeof target.sampleImageURL === "object"
      ? target.sampleImageURL
      : {}) ?? {}),
  });
  const sourceSample = /** @type {Record<string, string>} */ (
    source.sampleImageURL && typeof source.sampleImageURL === "object"
      ? source.sampleImageURL
      : {}
  );
  const merged = { ...targetSample };
  for (const [key, value] of Object.entries(sourceSample)) {
    if (!merged[key] && nonEmptyString(value)) merged[key] = value;
  }
  if (Object.keys(merged).length === 0) return target;
  return { ...target, sampleImageURL: merged };
}

/** @param {Record<string, unknown>} target @param {Record<string, unknown>} source */
function mergeScalar(target, source, key) {
  if (nonEmptyString(target[key])) return target;
  if (!nonEmptyString(source[key])) return target;
  return { ...target, [key]: source[key] };
}

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
export function mergeCatalogWorks(a, b) {
  const ordered =
    scoreCatalogWork(a, 0) >= scoreCatalogWork(b, 1) ? [a, b] : [b, a];
  let merged = { ...ordered[0] };
  const other = ordered[1];

  merged = mergeScalar(merged, other, "title");
  merged = mergeScalar(merged, other, "description");
  merged = mergeScalar(merged, other, "affiliateURL");
  merged = mergeScalar(merged, other, "URL");
  merged = mergeScalar(merged, other, "date");
  merged = mergeScalar(merged, other, "volume");
  merged = mergeScalar(merged, other, "addedAt");

  if (!hasImage(merged) && hasImage(other)) {
    merged = { ...merged, imageURL: other.imageURL };
  }

  if (
    (merged.sourcePopularityRank == null || merged.sourcePopularityRank === undefined) &&
    typeof other.sourcePopularityRank === "number"
  ) {
    merged = { ...merged, sourcePopularityRank: other.sourcePopularityRank };
  }

  if (
    (merged.popularityUpdatedAt == null || merged.popularityUpdatedAt === undefined) &&
    other.popularityUpdatedAt
  ) {
    merged = { ...merged, popularityUpdatedAt: other.popularityUpdatedAt };
  }

  const mergedPrices = { .../** @type {object} */ (merged.prices ?? {}) };
  const otherPrices = /** @type {{price?: string}} */ (other.prices ?? {});
  if (!nonEmptyString(mergedPrices.price) && nonEmptyString(otherPrices.price)) {
    merged = { ...merged, prices: { ...mergedPrices, price: otherPrices.price } };
  }

  for (const field of ["actress", "genre", "maker", "label", "series"]) {
    merged = mergeNamedArrayField(merged, other, field);
  }

  merged = mergeSampleImages(merged, other);

  if (!nonEmptyString(merged.content_id) && nonEmptyString(other.content_id)) {
    merged = { ...merged, content_id: other.content_id };
  }
  if (!nonEmptyString(merged.product_id) && nonEmptyString(other.product_id)) {
    merged = { ...merged, product_id: other.product_id };
  }

  return merged;
}

/** @param {Record<string, unknown>[]} works */
export function mergeCatalogWorkGroup(works) {
  return works.reduce((acc, work) => mergeCatalogWorks(acc, work), works[0]);
}

/**
 * @param {Record<string, unknown>[]} items
 * @returns {{
 *   items: Record<string, unknown>[];
 *   stats: {
 *     originalCount: number;
 *     dedupedCount: number;
 *     duplicateGroups: number;
 *     removedCount: number;
 *     mergedCount: number;
 *     groups: Array<{
 *       indices: number[];
 *       contentId: string;
 *       productId: string;
 *       title: string;
 *       keepIndex: number;
 *       removeIndices: number[];
 *     }>;
 *   };
 * }}
 */
export function dedupeCatalogWorks(items) {
  const originalCount = items.length;
  const parent = items.map((_, index) => index);

  /** @param {number} x */
  function find(x) {
    let root = x;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  }

  /** @param {number} a @param {number} b */
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  /** @type {Map<string, number[]>} */
  const keyToIndices = new Map();
  items.forEach((item, index) => {
    if (!hasWorkIdentity(item)) return;
    for (const key of getWorkMatchKeys(item)) {
      const bucket = keyToIndices.get(key) ?? [];
      bucket.push(index);
      keyToIndices.set(key, bucket);
    }
  });

  for (const indices of keyToIndices.values()) {
    if (indices.length < 2) continue;
    const base = indices[0];
    for (let i = 1; i < indices.length; i += 1) {
      union(base, indices[i]);
    }
  }

  /** @type {Map<number, number[]>} */
  const groupsByRoot = new Map();
  for (let index = 0; index < items.length; index += 1) {
    if (!hasWorkIdentity(items[index])) continue;
    const root = find(index);
    const group = groupsByRoot.get(root) ?? [];
    group.push(index);
    groupsByRoot.set(root, group);
  }

  /** @type {Set<number>} */
  const removeIndices = new Set();
  /** @type {Map<number, Record<string, unknown>>} */
  const replaceAt = new Map();
  /** @type {Array<{
   *   indices: number[];
   *   contentId: string;
   *   productId: string;
   *   title: string;
   *   keepIndex: number;
   *   removeIndices: number[];
   * }>} */
  const groups = [];
  let mergedCount = 0;

  for (const indices of groupsByRoot.values()) {
    if (indices.length <= 1) continue;
    const sorted = [...indices].sort((a, b) => a - b);
    const keepIndex = sorted[0];
    const groupWorks = sorted.map((index) => items[index]);
    const merged = mergeCatalogWorkGroup(groupWorks);
    replaceAt.set(keepIndex, merged);
    for (const index of sorted.slice(1)) {
      removeIndices.add(index);
    }
    mergedCount += sorted.length - 1;
    const sample = items[sorted[0]];
    groups.push({
      indices: sorted,
      contentId: String(sample.content_id ?? ""),
      productId: String(sample.product_id ?? ""),
      title: String(sample.title ?? "").slice(0, 80),
      keepIndex,
      removeIndices: sorted.slice(1),
    });
  }

  /** @type {Record<string, unknown>[]} */
  const deduped = [];
  for (let index = 0; index < items.length; index += 1) {
    if (removeIndices.has(index)) continue;
    deduped.push(replaceAt.get(index) ?? items[index]);
  }

  return {
    items: deduped,
    stats: {
      originalCount,
      dedupedCount: deduped.length,
      duplicateGroups: groups.length,
      removedCount: originalCount - deduped.length,
      mergedCount,
      groups,
    },
  };
}

/** @param {Record<string, unknown>[]} items */
export function analyzeCatalogDuplicates(items) {
  const byContentId = new Map();
  const byProductId = new Map();
  const byNormContentId = new Map();
  const byNormProductId = new Map();

  items.forEach((item, index) => {
    const cid = String(item.content_id ?? "").trim().toLowerCase();
    const pid = String(item.product_id ?? "").trim().toLowerCase();
    const ncid = normalizeWorkId(item.content_id);
    const npid = normalizeWorkId(item.product_id);
    if (cid) {
      const bucket = byContentId.get(cid) ?? [];
      bucket.push(index);
      byContentId.set(cid, bucket);
    }
    if (pid) {
      const bucket = byProductId.get(pid) ?? [];
      bucket.push(index);
      byProductId.set(pid, bucket);
    }
    if (ncid) {
      const bucket = byNormContentId.get(ncid) ?? [];
      bucket.push(index);
      byNormContentId.set(ncid, bucket);
    }
    if (npid) {
      const bucket = byNormProductId.get(npid) ?? [];
      bucket.push(index);
      byNormProductId.set(npid, bucket);
    }
  });

  function countGroups(map) {
    const groups = [...map.values()].filter((indices) => indices.length > 1);
    const removeCandidates = groups.reduce(
      (sum, indices) => sum + (indices.length - 1),
      0,
    );
    return { groups: groups.length, removeCandidates };
  }

  const deduped = dedupeCatalogWorks(items);

  return {
    catalogTotal: items.length,
    contentIdDuplicateGroups: countGroups(byContentId).groups,
    productIdDuplicateGroups: countGroups(byProductId).groups,
    normalizedContentIdDuplicateGroups: countGroups(byNormContentId).groups,
    normalizedProductIdDuplicateGroups: countGroups(byNormProductId).groups,
    identityDuplicateGroups: deduped.stats.duplicateGroups,
    identityRemoveCandidates: deduped.stats.removedCount,
    topGroups: deduped.stats.groups.slice(0, 20),
    deduped,
  };
}
