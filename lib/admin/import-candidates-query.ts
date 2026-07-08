import "server-only";

import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import { storedCandidateToDmmItem } from "@/lib/admin/import-candidate-mapper";
import type {
  ImportCandidateListItem,
  ImportCandidatesListResult,
  ImportCandidateSortKey,
  ImportCandidatesSummary,
  StoredImportCandidate,
} from "@/lib/admin/import-candidate-types";
import { loadImportCandidates } from "@/lib/admin/import-candidates-store";
import {
  getImportQualityFlags,
  matchesImportFilters,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";
import { IMPORT_PAGE_SIZE } from "@/lib/admin/import-constants";

export type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";

function buildSummary(records: StoredImportCandidate[]): ImportCandidatesSummary {
  let candidateCount = 0;
  let addedCount = 0;
  let excludedCount = 0;
  let lastCollectedAt: string | null = null;

  for (const record of records) {
    if (record.status === "candidate") candidateCount += 1;
    if (record.status === "added") addedCount += 1;
    if (record.status === "excluded") excludedCount += 1;

    if (!lastCollectedAt || record.collectedAt > lastCollectedAt) {
      lastCollectedAt = record.collectedAt;
    }
  }

  return {
    publishedCount: readCatalogSnapshot().length,
    candidateCount,
    addedCount,
    excludedCount,
    lastCollectedAt,
  };
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
    case "collectedAt-desc":
      return items.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    case "releaseDate-desc":
      return items.sort((a, b) =>
        compareReleaseDate(storedCandidateToDmmItem(a), storedCandidateToDmmItem(b)),
      );
    case "price-desc":
      return items.sort((a, b) =>
        comparePriceDesc(storedCandidateToDmmItem(a), storedCandidateToDmmItem(b)),
      );
    case "actress-first":
      return items.sort((a, b) => {
        const actressA = getImportQualityFlags(storedCandidateToDmmItem(a)).hasActress
          ? 1
          : 0;
        const actressB = getImportQualityFlags(storedCandidateToDmmItem(b)).hasActress
          ? 1
          : 0;
        if (actressA !== actressB) return actressB - actressA;
        return b.collectedAt.localeCompare(a.collectedAt);
      });
    case "image-first":
      return items.sort((a, b) => {
        const imageA = getImportQualityFlags(storedCandidateToDmmItem(a)).hasImage
          ? 1
          : 0;
        const imageB = getImportQualityFlags(storedCandidateToDmmItem(b)).hasImage
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

export async function getImportCandidatesList(options: {
  page?: number;
  sort?: ImportCandidateSortKey;
  filters?: ImportFilterKey[];
}): Promise<ImportCandidatesListResult> {
  const { records } = await loadImportCandidates();
  return buildImportCandidatesListFromRecords(records, options);
}

export function buildImportCandidatesListFromRecords(
  records: StoredImportCandidate[],
  options: {
    page?: number;
    sort?: ImportCandidateSortKey;
    filters?: ImportFilterKey[];
  } = {},
): ImportCandidatesListResult {
  const page = Math.max(1, options.page ?? 1);
  const sort = options.sort ?? "collectedAt-desc";
  const filterSet = new Set(options.filters ?? []);

  const summary = buildSummary(records);

  const candidateRecords = records.filter((record) => record.status === "candidate");
  const filtered = candidateRecords.filter((record) =>
    matchesImportFilters(storedCandidateToDmmItem(record), filterSet),
  );
  const sorted = sortCandidates(filtered, sort);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / IMPORT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * IMPORT_PAGE_SIZE;
  const pageRecords = sorted.slice(start, start + IMPORT_PAGE_SIZE);

  return {
    summary,
    candidates: pageRecords.map((record) => ({
      contentId: record.content_id,
      item: storedCandidateToDmmItem(record),
      source: record.source,
      collectedAt: record.collectedAt,
    })),
    pagination: {
      page: safePage,
      pageSize: IMPORT_PAGE_SIZE,
      totalPages,
      totalCount,
    },
  };
}
