import "server-only";

import {
  getExistingCatalogKeySet,
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
  ImportFetchSort,
} from "@/lib/admin/import-simple-types";
import {
  DMM_ITEMLIST_MAX_HITS,
  IMPORT_FETCH_MAX_SCAN_MULTIPLIER,
  IMPORT_FETCH_REQUEST_DEFAULT,
  IMPORT_FETCH_REQUEST_MAX,
} from "@/lib/admin/import-constants";
import {
  buildWorkIdentityKeys,
  keysMatchAny,
} from "@/lib/admin/import-identity";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
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
      `取得件数は1〜${IMPORT_FETCH_REQUEST_MAX}の整数で指定してください。`,
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

function createFetchBlockContext(): FetchBlockContext {
  return {
    catalogKeys: new Set<string>(),
    batchKeys: new Set<string>(),
  };
}

async function loadCatalogKeysForFetch(): Promise<Set<string>> {
  if (isGitHubCatalogConfigured()) {
    try {
      const { items } = await fetchCatalogFromGitHub();
      const keys = new Set<string>();
      for (const item of items) {
        for (const key of buildWorkIdentityKeys(item).allKeys) {
          keys.add(key);
        }
      }
      return keys;
    } catch (error) {
      console.warn(
        "[fetch-candidates] GitHub catalog read failed; falling back to local snapshot",
        error,
      );
    }
  }

  return getExistingCatalogKeySet();
}

function classifyFetchItem(
  item: DmmItem,
  context: FetchBlockContext,
): FetchRejectReason | null {
  const identity = buildWorkIdentityKeys(item);
  if (!identity.contentId && !identity.productId) return "invalid";

  if (keysMatchAny(identity.allKeys, context.catalogKeys)) {
    return "catalogPublished";
  }
  if (keysMatchAny(identity.allKeys, context.batchKeys)) {
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

  for (const key of buildWorkIdentityKeys(item).allKeys) {
    context.batchKeys.add(key);
  }
  return true;
}

function toFetchedCandidate(
  item: DmmItem,
  rankPosition: number | null,
): FetchedImportCandidate {
  const contentId = normalizeImportContentId(item.content_id);
  const productId = normalizeImportContentId(item.product_id ?? "");

  return {
    item,
    contentId,
    productId,
    rankPosition,
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
  const maxApiScanCount = requestedCount * IMPORT_FETCH_MAX_SCAN_MULTIPLIER;
  const blockContext = createFetchBlockContext();
  blockContext.catalogKeys = await loadCatalogKeysForFetch();
  const candidates: FetchedImportCandidate[] = [];

  const summary: FetchImportCandidatesSummary = {
    requestedCount,
    apiFetchedCount: 0,
    publishedExcludedCount: 0,
    duplicateExcludedCount: 0,
    invalidExcludedCount: 0,
    imageMissingExcludedCount: 0,
    candidateCount: 0,
    startOffset,
    nextOffset: startOffset,
  };

  let currentOffset = startOffset;
  let fetchCompleted = false;
  const plannedPages = planCollectPages(maxApiScanCount, pageSize);

  for (let pageIndex = 0; pageIndex < plannedPages; pageIndex += 1) {
    if (candidates.length >= requestedCount) break;
    if (summary.apiFetchedCount >= maxApiScanCount) break;
    if (fetchCompleted) break;

    const hits = nextCollectPageHits(
      maxApiScanCount,
      summary.apiFetchedCount,
      pageSize,
    );

    const page = await fetchDmmPage(currentOffset, hits, dmmSort);
    const pageItems = page.items;
    summary.apiFetchedCount += pageItems.length;

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

      candidates.push(
        toFetchedCandidate(
          item,
          sort === "popular" ? currentOffset + index : null,
        ),
      );
    }

    currentOffset += pageItems.length;
    summary.nextOffset = currentOffset;
  }

  summary.candidateCount = candidates.length;

  return { candidates, summary };
}
