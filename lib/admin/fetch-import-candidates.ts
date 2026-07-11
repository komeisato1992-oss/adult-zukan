import "server-only";

import {
  hasCollectibleImage,
} from "@/lib/admin/import-collect-filters";
import { fetchCatalogFromGitHub } from "@/lib/admin/github-catalog";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import {
  nextCollectPageHits,
  normalizeDmmOffset,
  planCollectPages,
} from "@/lib/admin/import-collect-params";
import type {
  FetchImportCandidatesResult,
  FetchImportCandidatesSummary,
  FetchedImportCandidate,
  ImportCandidateMeta,
  ImportFetchSort,
} from "@/lib/admin/import-simple-types";
import {
  DMM_ITEMLIST_MAX_HITS,
  IMPORT_FETCH_MAX_SCAN_MULTIPLIER,
  IMPORT_FETCH_REQUEST_DEFAULT,
  IMPORT_FETCH_REQUEST_MAX,
} from "@/lib/admin/import-constants";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import {
  buildCatalogIdSet,
  workMatchesCatalogIds,
} from "@/lib/dmm/catalog-dedupe";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmFetchOptions } from "@/lib/dmm/types";
import type { DmmItem } from "@/lib/dmm/types";

export class FetchImportCandidatesError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FetchImportCandidatesError";
    this.status = status;
  }
}

type FetchBlockContext = {
  catalogKeys: Set<string>;
  batchKeys: Set<string>;
};

type FetchRejectReason =
  | "catalogPublished"
  | "duplicate"
  | "noImage"
  | "invalid";

type CatalogKeyLoadResult = {
  keys: Set<string>;
  catalogCount: number;
};

function getSortForFetch(sort: ImportFetchSort): DmmFetchOptions["sort"] {
  return sort === "popular" ? "rank" : "date";
}

function parseRequestedCount(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return IMPORT_FETCH_REQUEST_DEFAULT;
  }

  const numeric =
    typeof value === "string" ? Number(value.trim()) : Number(value);

  if (
    !Number.isFinite(numeric) ||
    !Number.isInteger(numeric) ||
    numeric < 1 ||
    numeric > IMPORT_FETCH_REQUEST_MAX
  ) {
    throw new FetchImportCandidatesError(
      `未掲載候補の目標件数は1〜${IMPORT_FETCH_REQUEST_MAX}の整数で指定してください。`,
    );
  }

  return numeric;
}

function parseStartOffset(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric =
    typeof value === "string" ? Number(value.trim()) : Number(value);

  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw new FetchImportCandidatesError(
      "開始offsetは0以上の整数で指定してください。",
    );
  }

  return normalizeDmmOffset(numeric);
}

function parseFetchSort(value: unknown): ImportFetchSort {
  if (value === undefined || value === null || value === "") {
    return "popular";
  }

  if (value === "popular") {
    return "popular";
  }

  throw new FetchImportCandidatesError(
    '並び順は "popular" のみ指定できます。',
  );
}

async function loadCatalogKeysForFetch(): Promise<CatalogKeyLoadResult> {
  if (isGitHubCatalogConfigured()) {
    try {
      const { items } = await fetchCatalogFromGitHub();
      return { keys: buildCatalogIdSet(items), catalogCount: items.length };
    } catch (error) {
      console.warn(
        "[fetch-candidates] GitHub catalog read failed; falling back to local snapshot",
        error,
      );
    }
  }

  const items = readCatalogSnapshot();
  return { keys: buildCatalogIdSet(items), catalogCount: items.length };
}

function classifyFetchItem(
  item: DmmItem,
  context: FetchBlockContext,
): FetchRejectReason | null {
  if (!item.content_id?.trim() && !item.product_id?.trim()) return "invalid";

  if (workMatchesCatalogIds(item, context.catalogKeys)) {
    return "catalogPublished";
  }
  if (workMatchesCatalogIds(item, context.batchKeys)) {
    return "duplicate";
  }
  if (!hasCollectibleImage(item)) return "noImage";
  if (!isValidDmmListItem(item)) return "invalid";

  return null;
}

function recordFetchExclusion(
  summary: FetchImportCandidatesSummary,
  reason: FetchRejectReason,
): void {
  switch (reason) {
    case "catalogPublished":
      summary.publishedExcludedCount += 1;
      break;
    case "duplicate":
      summary.duplicateExcludedCount += 1;
      break;
    case "noImage":
      summary.imageMissingExcludedCount += 1;
      break;
    case "invalid":
      summary.invalidExcludedCount += 1;
      break;
    default:
      break;
  }
}

function rememberBatchKeys(item: DmmItem, context: FetchBlockContext): void {
  for (const key of buildCatalogIdSet([item])) {
    context.batchKeys.add(key);
  }
}

function acceptFetchItem(
  item: DmmItem,
  context: FetchBlockContext,
  summary: FetchImportCandidatesSummary,
): boolean {
  const reason = classifyFetchItem(item, context);
  if (reason) {
    recordFetchExclusion(summary, reason);
    return false;
  }

  rememberBatchKeys(item, context);
  return true;
}

function toFetchedCandidate(
  item: DmmItem,
  input: {
    sort: ImportFetchSort;
    sourceOffset: number;
    sourceIndex: number;
    absolutePopularityPosition: number;
  },
): FetchedImportCandidate {
  const contentId = normalizeImportContentId(item.content_id);
  const productId = normalizeImportContentId(item.product_id ?? "");
  const candidateMeta: ImportCandidateMeta = {
    sourceSort: input.sort,
    sourceOffset: input.sourceOffset,
    sourceIndex: input.sourceIndex,
    absolutePopularityPosition: input.absolutePopularityPosition,
  };

  return {
    item,
    contentId,
    productId,
    rankPosition: input.absolutePopularityPosition,
    candidateMeta,
  };
}

async function fetchDmmPage(
  offset: number,
  hits: number,
  sort: DmmFetchOptions["sort"],
): Promise<{ items: DmmItem[]; resultCount: number }> {
  const response = await fetchDmmItemList({
    sort,
    hits,
    offset,
    cache: "no-store",
  });

  const items = response.result.items ?? [];

  return {
    items,
    resultCount: response.result.result_count ?? items.length,
  };
}

function buildFetchSummaryMessage(summary: FetchImportCandidatesSummary): string {
  const {
    requestedCount,
    maxScanCount,
    apiFetchedCount,
    candidateCount,
    targetReached,
    popularityRangeMin,
    popularityRangeMax,
  } = summary;

  const rangeText =
    popularityRangeMin != null && popularityRangeMax != null
      ? `人気順位範囲：${popularityRangeMin.toLocaleString()}位〜${popularityRangeMax.toLocaleString()}位`
      : null;

  if (targetReached) {
    return [
      `FANZA人気順から${apiFetchedCount.toLocaleString()}件を確認し、未掲載の人気作品${candidateCount.toLocaleString()}件を候補として取得しました。`,
      rangeText,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `FANZA人気順を最大${maxScanCount.toLocaleString()}件確認し、未掲載候補を${candidateCount.toLocaleString()}件取得しました。指定数${requestedCount.toLocaleString()}件には届きませんでした。`,
    rangeText,
  ]
    .filter(Boolean)
    .join("\n");
}

function updatePopularityRange(
  summary: FetchImportCandidatesSummary,
  position: number,
): void {
  if (summary.popularityRangeMin == null || position < summary.popularityRangeMin) {
    summary.popularityRangeMin = position;
  }
  if (summary.popularityRangeMax == null || position > summary.popularityRangeMax) {
    summary.popularityRangeMax = position;
  }
}

export function parseFetchCandidatesRequest(body: unknown): {
  sort: ImportFetchSort;
  offset: number;
  requestedCount: number;
} {
  if (!body || typeof body !== "object") {
    throw new FetchImportCandidatesError("リクエスト形式が不正です。");
  }

  const payload = body as Record<string, unknown>;

  return {
    sort: parseFetchSort(payload.sort),
    offset: parseStartOffset(payload.offset),
    requestedCount: parseRequestedCount(payload.requestedCount),
  };
}

export async function fetchImportCandidates(input: {
  sort: ImportFetchSort;
  offset: number;
  requestedCount: number;
}): Promise<FetchImportCandidatesResult> {
  if (!isDmmConfigured()) {
    throw new FetchImportCandidatesError(
      "FANZA API の設定が未完了です。",
      503,
    );
  }

  const { sort, requestedCount } = input;
  const startOffset = normalizeDmmOffset(input.offset);
  const dmmSort = getSortForFetch(sort);
  const pageSize = DMM_ITEMLIST_MAX_HITS;
  const maxScanCount = requestedCount * IMPORT_FETCH_MAX_SCAN_MULTIPLIER;
  const { keys: catalogKeys, catalogCount } = await loadCatalogKeysForFetch();
  const blockContext: FetchBlockContext = {
    catalogKeys,
    batchKeys: new Set<string>(),
  };
  const candidates: FetchedImportCandidate[] = [];

  const summary: FetchImportCandidatesSummary = {
    requestedCount,
    maxScanCount,
    apiFetchedCount: 0,
    publishedExcludedCount: 0,
    duplicateExcludedCount: 0,
    invalidExcludedCount: 0,
    imageMissingExcludedCount: 0,
    candidateCount: 0,
    catalogCount,
    startOffset,
    nextOffset: startOffset,
    scanStartOffset: startOffset,
    scanEndOffset: startOffset,
    popularityRangeMin: null,
    popularityRangeMax: null,
    targetReached: false,
    message: "",
  };

  let currentOffset = startOffset;
  let fetchCompleted = false;
  const plannedPages = planCollectPages(maxScanCount, pageSize);

  for (let pageIndex = 0; pageIndex < plannedPages; pageIndex += 1) {
    if (candidates.length >= requestedCount) break;
    if (summary.apiFetchedCount >= maxScanCount) break;
    if (fetchCompleted) break;

    const hits = nextCollectPageHits(
      maxScanCount,
      summary.apiFetchedCount,
      pageSize,
    );

    const page = await fetchDmmPage(currentOffset, hits, dmmSort);
    const pageItems = page.items;
    summary.apiFetchedCount += pageItems.length;
    summary.scanEndOffset = currentOffset + pageItems.length;

    if (pageItems.length === 0) {
      fetchCompleted = true;
      break;
    }

    for (let index = 0; index < pageItems.length; index += 1) {
      if (candidates.length >= requestedCount) break;

      const item = pageItems[index];
      if (!acceptFetchItem(item, blockContext, summary)) {
        continue;
      }

      const absolutePopularityPosition = currentOffset + index;
      const candidate = toFetchedCandidate(item, {
        sort,
        sourceOffset: currentOffset,
        sourceIndex: index,
        absolutePopularityPosition,
      });

      candidates.push(candidate);
      updatePopularityRange(summary, absolutePopularityPosition);
    }

    currentOffset += pageItems.length;
    summary.nextOffset = currentOffset;

    if (pageItems.length < hits) {
      fetchCompleted = true;
    }
  }

  summary.candidateCount = candidates.length;
  summary.targetReached = candidates.length >= requestedCount;
  summary.message = buildFetchSummaryMessage(summary);

  return { candidates, summary };
}
