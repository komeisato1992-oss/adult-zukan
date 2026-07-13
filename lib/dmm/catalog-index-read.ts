import "server-only";

import { existsSync, readFileSync } from "fs";
import path from "path";
import { CATALOG_INDEX_PATHS } from "@/lib/dmm/index-paths";

type IndexEnvelope<T> = {
  items?: T[];
};

function readCatalogIndexItems<T>(relativePath: string): T[] {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as
      | T[]
      | IndexEnvelope<T>;
    return Array.isArray(raw) ? raw : (raw.items ?? []);
  } catch {
    return [];
  }
}

export type CatalogIndexNameEntry = {
  name: string;
  slug: string;
  workCount?: number;
};

export type CatalogIndexLabelEntry = CatalogIndexNameEntry & {
  makerName?: string;
  makerSlug?: string;
};

export type CatalogIndexSeriesEntry = CatalogIndexNameEntry & {
  makerName?: string;
  makerSlug?: string;
};

export type CatalogIndexActressEntry = CatalogIndexNameEntry & {
  slug: string;
  imageUrl?: string;
  reading?: string;
};

export function readCommittedActressIndex(): CatalogIndexActressEntry[] {
  return readCatalogIndexItems<CatalogIndexActressEntry>(
    CATALOG_INDEX_PATHS.actresses,
  );
}

export function readCommittedMakerIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.makers,
  );
}

export function readCommittedLabelIndex(): CatalogIndexLabelEntry[] {
  return readCatalogIndexItems<CatalogIndexLabelEntry>(
    CATALOG_INDEX_PATHS.labels,
  );
}

export function readCommittedSeriesIndex(): CatalogIndexSeriesEntry[] {
  return readCatalogIndexItems<CatalogIndexSeriesEntry>(
    CATALOG_INDEX_PATHS.series,
  );
}

export function readCommittedGenreIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.genres,
  );
}

function findIndexEntryBySlug<T extends { slug?: string }>(
  entries: T[],
  slug: string,
): T | undefined {
  if (!slug || !Array.isArray(entries)) return undefined;
  return entries.find((entry) => entry?.slug === slug);
}

export function findCommittedMakerBySlug(
  slug: string,
): CatalogIndexNameEntry | undefined {
  return findIndexEntryBySlug(readCommittedMakerIndex(), slug);
}

export function findCommittedLabelBySlug(
  slug: string,
): CatalogIndexLabelEntry | undefined {
  return findIndexEntryBySlug(readCommittedLabelIndex(), slug);
}

export function findCommittedSeriesBySlug(
  slug: string,
): CatalogIndexSeriesEntry | undefined {
  return findIndexEntryBySlug(readCommittedSeriesIndex(), slug);
}

export function findCommittedGenreBySlug(
  slug: string,
): CatalogIndexNameEntry | undefined {
  return findIndexEntryBySlug(readCommittedGenreIndex(), slug);
}

export function readCommittedSearchIndexContentIds(): string[] {
  const items = readCatalogIndexItems<{ contentId: string }>(
    CATALOG_INDEX_PATHS.searchIndex,
  );
  return items
    .map((entry) => entry.contentId?.trim())
    .filter((id): id is string => Boolean(id));
}
