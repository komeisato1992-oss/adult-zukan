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
import { loadImportCandidates } from "@/lib/admin/import-candidates-store";
import {
  buildSummaryFromListItems,
  isVisibleStoredCandidate,
  storedRecordToListItem,
} from "@/lib/admin/import-candidates-visibility";
import { loadImportCollectionState } from "@/lib/admin/import-collection-state-store";
import {
  getImportQualityFlags,
  matchesImportRecordFilters,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import { IMPORT_PAGE_SIZE } from "@/lib/admin/import-constants";
import { enrichRecordsWithSeo } from "@/lib/admin/import-seo-enrich";
import { compareSeoScoreDesc } from "@/lib/admin/import-seo-score";

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
};

export async function buildImportCandidatesListFromRecords(
  records: StoredImportCandidate[],
  options: BuildImportCandidatesListOptions = {},
): Promise<ImportCandidatesListResult> {
  const page = Math.max(1, options.page ?? 1);
  const sort = options.sort ?? "seoScore-desc";
  const filterSet = new Set(options.filters ?? []);
  const includeAll = options.includeAll ?? false;

  const enrichedRecords = await enrichRecordsWithSeo(records);
  const summary = await buildSummary(enrichedRecords);

  const candidateRecords = enrichedRecords.filter(isVisibleStoredCandidate);
  const filtered = candidateRecords.filter((record) =>
    matchesImportRecordFilters(record, filterSet),
  );
  const sorted = sortCandidates(filtered, sort);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / IMPORT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = includeAll ? 0 : (safePage - 1) * IMPORT_PAGE_SIZE;
  const end = includeAll ? sorted.length : start + IMPORT_PAGE_SIZE;
  const pageRecords = sorted.slice(start, end);

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
  const { records } = await loadImportCandidates();
  return buildImportCandidatesListFromRecords(records, options);
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
