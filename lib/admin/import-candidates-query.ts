import "server-only";

import { getImportWorkCounts } from "@/lib/admin/stats";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import type {
  ImportCandidateListItem,
  ImportCandidatesListResult,
  ImportCandidateSortKey,
  ImportCandidatesSummary,
  StoredImportCandidate,
} from "@/lib/admin/import-candidate-types";
import {
  loadImportCandidates,
  type ImportCandidatesDataSource,
} from "@/lib/admin/import-candidates-store";
import {
  buildSummaryFromListItems,
  isPendingImportCandidate,
  storedRecordToListItem,
} from "@/lib/admin/import-candidates-visibility";
import { loadImportCollectionState } from "@/lib/admin/import-collection-state-store";
import {
  getImportQualityFlags,
  matchesImportRecordFilters,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import { parseImportCandidateFilters } from "@/lib/admin/import-candidate-filters";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import { IMPORT_PAGE_SIZE } from "@/lib/admin/import-constants";
import { enrichRecordsWithSeo } from "@/lib/admin/import-seo-enrich";
import { compareSeoScoreDesc } from "@/lib/admin/import-seo-score";

export type ImportCandidatePipelineStages = {
  rawCandidateCount: number;
  normalizedCandidateCount: number;
  pendingCandidateCount: number;
  afterStatusFilterCount: number;
  afterQualityFilterCount: number;
  afterSearchFilterCount: number;
  afterExcludedIdsCount: number;
  afterDeduplicationCount: number;
  afterLimitCount: number;
  receivedTotalCount?: number;
  filters: ImportFilterKey[];
  dataSource: ImportCandidatesDataSource;
  parseShape: string;
  clientSampleIds: string[];
  serverSampleIds: string[];
};

export type GetFilteredImportCandidatesOptions = {
  records?: StoredImportCandidate[];
  dataSource?: ImportCandidatesDataSource;
  preEnriched?: boolean;
  filters?: ImportFilterKey[] | unknown;
  sort?: ImportCandidateSortKey;
  excludedIds?: string[];
  addLimit?: number;
  receivedTotalCount?: number;
  clientSampleIds?: string[];
};

export type GetFilteredImportCandidatesResult = {
  records: StoredImportCandidate[];
  candidates: ImportCandidateListItem[];
  totalCount: number;
  stages: ImportCandidatePipelineStages;
};

function detectImportCandidatesParseShape(records: StoredImportCandidate[]): string {
  if (records.length === 0) return "empty";
  const first = records[0];
  if (first.item && typeof first.item === "object" && first.item.content_id?.trim()) {
    return "array-with-nested-item";
  }
  if (first.title?.trim() || first.imageURL?.trim()) {
    return "array-with-flat-fields";
  }
  return "array-unknown-entry";
}

function dedupeStoredCandidates(
  records: StoredImportCandidate[],
): StoredImportCandidate[] {
  const seen = new Set<string>();
  const deduped: StoredImportCandidate[] = [];

  for (const record of records) {
    const id = normalizeImportContentId(record.content_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(record);
  }

  return deduped;
}

function applyExcludedIds(
  records: StoredImportCandidate[],
  excludedIds: string[],
): StoredImportCandidate[] {
  if (excludedIds.length === 0) return records;

  const excluded = new Set(
    excludedIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );

  return records.filter((record) => {
    const id = normalizeImportContentId(record.content_id);
    return id ? !excluded.has(id) : true;
  });
}

export async function getImportCandidates(): Promise<{
  records: StoredImportCandidate[];
  sha: string | null;
  dataSource: ImportCandidatesDataSource;
}> {
  return loadImportCandidates();
}

export async function getFilteredImportCandidates(
  options: GetFilteredImportCandidatesOptions = {},
): Promise<GetFilteredImportCandidatesResult> {
  const loaded =
    options.records != null
      ? {
          records: options.records,
          dataSource: options.dataSource ?? "local",
        }
      : await getImportCandidates();

  const filters = parseImportCandidateFilters(options.filters);
  const filterSet = new Set(filters);
  const sort = options.sort ?? "seoScore-desc";
  const excludedIds = options.excludedIds ?? [];

  const rawCandidateCount = loaded.records.length;
  const enrichedRecords = options.preEnriched
    ? loaded.records
    : await enrichRecordsWithSeo(loaded.records);
  const normalizedCandidateCount = enrichedRecords.length;

  const pendingRecords = enrichedRecords.filter(isPendingImportCandidate);
  const pendingCandidateCount = pendingRecords.length;
  const afterStatusFilterCount = pendingCandidateCount;

  const qualityFiltered = pendingRecords.filter((record) =>
    matchesImportRecordFilters(record, filterSet),
  );
  const afterQualityFilterCount = qualityFiltered.length;
  const afterSearchFilterCount = afterQualityFilterCount;

  const sorted = sortCandidates(qualityFiltered, sort);
  const afterExcluded = applyExcludedIds(sorted, excludedIds);
  const afterExcludedIdsCount = afterExcluded.length;

  const deduped = dedupeStoredCandidates(afterExcluded);
  const afterDeduplicationCount = deduped.length;

  const addLimit =
    typeof options.addLimit === "number" &&
    Number.isFinite(options.addLimit) &&
    options.addLimit > 0
      ? Math.floor(options.addLimit)
      : undefined;
  const limited =
    addLimit != null ? deduped.slice(0, addLimit) : deduped;
  const afterLimitCount = limited.length;

  const serverSampleIds = deduped
    .slice(0, 10)
    .map((record) => record.content_id.trim())
    .filter(Boolean);

  const stages: ImportCandidatePipelineStages = {
    rawCandidateCount,
    normalizedCandidateCount,
    pendingCandidateCount,
    afterStatusFilterCount,
    afterQualityFilterCount,
    afterSearchFilterCount,
    afterExcludedIdsCount,
    afterDeduplicationCount,
    afterLimitCount,
    receivedTotalCount: options.receivedTotalCount,
    filters,
    dataSource: loaded.dataSource,
    parseShape: detectImportCandidatesParseShape(enrichedRecords),
    clientSampleIds: options.clientSampleIds ?? [],
    serverSampleIds,
  };

  return {
    records: limited,
    candidates: limited.map(storedRecordToListItem),
    totalCount: deduped.length,
    stages,
  };
}

export function logImportCandidatePipelineStages(
  label: string,
  stages: ImportCandidatePipelineStages,
): void {
  console.log(label, stages);
}

export type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";

async function buildSummary(records: StoredImportCandidate[]): Promise<ImportCandidatesSummary> {
  const listItems = records.map(storedRecordToListItem);
  const counts = await getImportWorkCounts();
  const { state } = await loadImportCollectionState();
  return buildSummaryFromListItems(
    listItems,
    counts.publishedCount,
    counts.catalogTotalCount,
    state,
  );
}

function compareReleaseDate(a: DmmItem, b: DmmItem): number {
  const dateA = a.date ?? "";
  const dateB = b.date ?? "";
  return dateB.localeCompare(dateA);
}

function comparePriceDesc(a: DmmItem, b: DmmItem): number {
  const priceA = parseDmmPrice(a.prices?.price);
  const priceB = parseDmmPrice(b.prices?.price);
  return priceB - priceA;
}

function sortCandidates(
  records: StoredImportCandidate[],
  sort: ImportCandidateSortKey,
): StoredImportCandidate[] {
  const items = [...records];

  switch (sort) {
    case "seoScore-desc":
      return items.sort((a, b) =>
        compareSeoScoreDesc(a.seoScore ?? 0, b.seoScore ?? 0),
      );
    case "collectedAt-desc":
      return items.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    case "releaseDate-desc":
      return items.sort((a, b) =>
        compareReleaseDate(
          storedRecordToListItem(a).item,
          storedRecordToListItem(b).item,
        ),
      );
    case "price-desc":
      return items.sort((a, b) =>
        comparePriceDesc(
          storedRecordToListItem(a).item,
          storedRecordToListItem(b).item,
        ),
      );
    case "actress-first":
      return items.sort((a, b) => {
        const actressA = getImportQualityFlags(storedRecordToListItem(a).item)
          .hasActress
          ? 1
          : 0;
        const actressB = getImportQualityFlags(storedRecordToListItem(b).item)
          .hasActress
          ? 1
          : 0;
        if (actressA !== actressB) return actressB - actressA;
        return b.collectedAt.localeCompare(a.collectedAt);
      });
    case "image-first":
      return items.sort((a, b) => {
        const imageA = getImportQualityFlags(storedRecordToListItem(a).item)
          .hasImage
          ? 1
          : 0;
        const imageB = getImportQualityFlags(storedRecordToListItem(b).item)
          .hasImage
          ? 1
          : 0;
        if (imageA !== imageB) return imageB - imageA;
        return b.collectedAt.localeCompare(a.collectedAt);
      });
    case "random":
      for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
      }
      return items;
    default:
      return items;
  }
}

export type BuildImportCandidatesListOptions = {
  page?: number;
  sort?: ImportCandidateSortKey;
  filters?: ImportFilterKey[];
  includeAll?: boolean;
  dataSource?: ImportCandidatesDataSource;
};

export async function buildImportCandidatesListFromRecords(
  records: StoredImportCandidate[],
  options: BuildImportCandidatesListOptions = {},
): Promise<ImportCandidatesListResult> {
  const page = Math.max(1, options.page ?? 1);
  const sort = options.sort ?? "seoScore-desc";
  const includeAll = options.includeAll ?? false;

  const enrichedRecords = await enrichRecordsWithSeo(records);
  const filtered = await getFilteredImportCandidates({
    records: enrichedRecords,
    preEnriched: true,
    filters: options.filters,
    sort,
    dataSource: options.dataSource ?? "local",
  });

  const summary = await buildSummary(enrichedRecords);

  const totalCount = filtered.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / IMPORT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = includeAll ? 0 : (safePage - 1) * IMPORT_PAGE_SIZE;
  const end = includeAll ? filtered.records.length : start + IMPORT_PAGE_SIZE;
  const pageRecords = filtered.records.slice(start, end);

  return {
    summary,
    candidates: pageRecords.map(storedRecordToListItem),
    pagination: {
      page: includeAll ? 1 : safePage,
      pageSize: IMPORT_PAGE_SIZE,
      totalPages,
      totalCount,
    },
  };
}

export async function getImportCandidatesList(
  options: BuildImportCandidatesListOptions = {},
): Promise<ImportCandidatesListResult> {
  const { records, dataSource } = await loadImportCandidates();
  return buildImportCandidatesListFromRecords(records, {
    ...options,
    dataSource,
  });
}

export async function getAllImportCandidateListItems(): Promise<{
  candidates: ImportCandidateListItem[];
  summary: ImportCandidatesSummary;
}> {
  const { records } = await loadImportCandidates();
  const enrichedRecords = await enrichRecordsWithSeo(records);
  const listItems = enrichedRecords.map(storedRecordToListItem);
  const counts = await getImportWorkCounts();
  const { state } = await loadImportCollectionState();
  return {
    candidates: listItems,
    summary: buildSummaryFromListItems(
      listItems,
      counts.publishedCount,
      counts.catalogTotalCount,
      state,
    ),
  };
}
